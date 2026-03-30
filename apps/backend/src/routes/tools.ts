// apps/backend/src/routes/tools.ts
// REST API routes for Tools Registry

import { Router, Request, Response } from 'express'
import {
  getAllTools,
  getTool,
  getToolsByCategory,
  getToolsByRisk,
  validateToolParams,
  getAllAnthropicSchemas,
  type ToolCategory,
  type RiskLevel,
} from '../tools/registry'

const router = Router()

// GET /api/tools
router.get('/', (_req: Request, res: Response) => {
  const tools = getAllTools()
  res.json({ tools, count: tools.length })
})

// GET /api/tools/schemas (Anthropic format)
router.get('/schemas', (_req: Request, res: Response) => {
  res.json(getAllAnthropicSchemas())
})

// GET /api/tools/category/:category
router.get('/category/:category', (req: Request, res: Response) => {
  const tools = getToolsByCategory(req.params['category'] as ToolCategory)
  res.json({ tools, count: tools.length })
})

// GET /api/tools/risk/:level
router.get('/risk/:level', (req: Request, res: Response) => {
  const tools = getToolsByRisk(req.params['level'] as RiskLevel)
  res.json({ tools, count: tools.length })
})

// GET /api/tools/:name
router.get('/:name', (req: Request, res: Response) => {
  const tool = getTool(req.params['name'] ?? '')
  if (!tool) return res.status(404).json({ error: 'Tool not found' })
  res.json(tool)
})

// POST /api/tools/:name/validate
router.post('/:name/validate', (req: Request, res: Response) => {
  const result = validateToolParams(
    req.params['name'] ?? '',
    req.body as Record<string, unknown>
  )
  res.json(result)
})

export default router
