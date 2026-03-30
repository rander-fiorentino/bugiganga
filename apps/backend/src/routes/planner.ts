// apps/backend/src/routes/planner.ts
// REST API routes for Planner System

import { Router, Request, Response } from 'express'
import {
  createPlan,
  getPlan,
  updateStepStatus,
  refinePlan,
  getNextStep,
  isPlanComplete,
  isPlanFailed,
  estimateComplexity,
} from '../planner/index'

const router = Router()

// POST /api/planner/plan
router.post('/plan', async (req: Request, res: Response) => {
  try {
    const { goal, context } = req.body as { goal: string; context?: string }
    if (!goal) return res.status(400).json({ error: 'goal is required' })
    const plan = await createPlan(goal, context)
    res.status(201).json(plan)
  } catch (err) {
    res.status(500).json({ error: 'Failed to create plan', details: String(err) })
  }
})

// GET /api/planner/plan/:id
router.get('/plan/:id', (req: Request, res: Response) => {
  const plan = getPlan(req.params['id'] ?? '')
  if (!plan) return res.status(404).json({ error: 'Plan not found' })
  res.json(plan)
})

// GET /api/planner/plan/:id/next
router.get('/plan/:id/next', (req: Request, res: Response) => {
  const plan = getPlan(req.params['id'] ?? '')
  if (!plan) return res.status(404).json({ error: 'Plan not found' })
  const next = getNextStep(req.params['id'] ?? '')
  res.json({
    step: next,
    complete: isPlanComplete(req.params['id'] ?? ''),
    failed: isPlanFailed(req.params['id'] ?? ''),
  })
})

// PATCH /api/planner/plan/:id/step/:stepId
router.patch('/plan/:id/step/:stepId', (req: Request, res: Response) => {
  const { status, result, error } = req.body as {
    status: 'pending' | 'running' | 'done' | 'failed' | 'skipped'
    result?: string
    error?: string
  }
  if (!status) return res.status(400).json({ error: 'status is required' })
  const updated = updateStepStatus(
    req.params['id'] ?? '',
    req.params['stepId'] ?? '',
    status,
    result,
    error
  )
  if (!updated) return res.status(404).json({ error: 'Plan or step not found' })
  res.json(updated)
})

// POST /api/planner/plan/:id/refine
router.post('/plan/:id/refine', async (req: Request, res: Response) => {
  try {
    const { observation } = req.body as { observation: string }
    if (!observation) return res.status(400).json({ error: 'observation is required' })
    const refined = await refinePlan(req.params['id'] ?? '', observation)
    if (!refined) return res.status(404).json({ error: 'Plan not found' })
    res.json(refined)
  } catch (err) {
    res.status(500).json({ error: 'Failed to refine plan', details: String(err) })
  }
})

// POST /api/planner/estimate
router.post('/estimate', (req: Request, res: Response) => {
  const { goal } = req.body as { goal: string }
  if (!goal) return res.status(400).json({ error: 'goal is required' })
  const complexity = estimateComplexity(goal)
  res.json({ goal, complexity })
})

export default router
