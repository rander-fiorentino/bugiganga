// apps/backend/src/planner/index.ts
// Advanced Planner with Claude-powered decomposition and adaptive re-planning

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type StepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped'
export type Complexity = 'simple' | 'medium' | 'complex'

export interface PlanStep {
  id: string
  description: string
  expectedOutcome: string
  estimatedMs: number
  dependsOn: string[]
  status: StepStatus
  result?: string
  error?: string
}

export interface Plan {
  id: string
  goal: string
  complexity: Complexity
  steps: PlanStep[]
  createdAt: Date
  updatedAt: Date
  version: number
}

// ── In-memory store ──────────────────────────────────────────────
const plans = new Map<string, Plan>()

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

// ── Complexity estimation (no LLM needed) ────────────────────────
export function estimateComplexity(goal: string): Complexity {
  const words = goal.split(/\s+/).length
  const hasMultipleSteps = /then|after|next|finally|first|second/i.test(goal)
  const hasConditions = /if|when|unless|depending/i.test(goal)

  if (words < 8 && !hasMultipleSteps && !hasConditions) return 'simple'
  if (words > 30 || (hasMultipleSteps && hasConditions)) return 'complex'
  return 'medium'
}

// ── Create plan via Claude ────────────────────────────────────────
export async function createPlan(
  goal: string,
  context?: string
): Promise<Plan> {
  const complexity = estimateComplexity(goal)

  let steps: PlanStep[]

  if (process.env.ANTHROPIC_API_KEY) {
    steps = await decomposWithClaude(goal, complexity, context)
  } else {
    steps = createFallbackPlan(goal)
  }

  const plan: Plan = {
    id: generateId('plan'),
    goal,
    complexity,
    steps,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
  }

  plans.set(plan.id, plan)
  return plan
}

async function decomposWithClaude(
  goal: string,
  complexity: Complexity,
  context?: string
): Promise<PlanStep[]> {
  const maxSteps = complexity === 'simple' ? 3 : complexity === 'medium' ? 6 : 10

  const prompt = `You are a task planning assistant. Decompose the following goal into concrete, executable steps.

Goal: ${goal}
Complexity: ${complexity}
${context ? `Context: ${context}` : ''}

Return a JSON array of steps. Each step must have:
- id: string (step_1, step_2, ...)
- description: string (what to do, max 100 chars)
- expectedOutcome: string (what success looks like)
- estimatedMs: number (estimated duration in ms, realistic: 500-10000)
- dependsOn: string[] (IDs of steps that must complete first)

Maximum ${maxSteps} steps. Return ONLY valid JSON, no markdown.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const parsed: Array<{
      id: string
      description: string
      expectedOutcome: string
      estimatedMs: number
      dependsOn: string[]
    }> = JSON.parse(text)

    return parsed.map(s => ({
      id: s.id,
      description: s.description,
      expectedOutcome: s.expectedOutcome,
      estimatedMs: s.estimatedMs,
      dependsOn: s.dependsOn,
      status: 'pending' as StepStatus,
    }))
  } catch {
    return createFallbackPlan(goal)
  }
}

function createFallbackPlan(goal: string): PlanStep[] {
  return [
    {
      id: 'step_1',
      description: `Navigate to target page for: ${goal.slice(0, 60)}`,
      expectedOutcome: 'Target page loaded',
      estimatedMs: 2000,
      dependsOn: [],
      status: 'pending',
    },
    {
      id: 'step_2',
      description: 'Execute primary action',
      expectedOutcome: 'Action completed successfully',
      estimatedMs: 3000,
      dependsOn: ['step_1'],
      status: 'pending',
    },
    {
      id: 'step_3',
      description: 'Verify result and extract data',
      expectedOutcome: 'Result confirmed',
      estimatedMs: 1000,
      dependsOn: ['step_2'],
      status: 'pending',
    },
  ]
}

// ── Update step status ────────────────────────────────────────────
export function updateStepStatus(
  planId: string,
  stepId: string,
  status: StepStatus,
  result?: string,
  error?: string
): Plan | null {
  const plan = plans.get(planId)
  if (!plan) return null

  const step = plan.steps.find(s => s.id === stepId)
  if (!step) return null

  step.status = status
  if (result) step.result = result
  if (error) step.error = error
  plan.updatedAt = new Date()

  return plan
}

// ── Adaptive re-planning (trigger every N iterations) ───────────────
export async function refinePlan(
  planId: string,
  currentObservation: string
): Promise<Plan | null> {
  const plan = plans.get(planId)
  if (!plan) return null

  const failedSteps = plan.steps.filter(s => s.status === 'failed')
  const pendingSteps = plan.steps.filter(s => s.status === 'pending')

  if (failedSteps.length === 0 && pendingSteps.length > 0) return plan

  // No failed steps or nothing remaining — no need to re-plan
  if (pendingSteps.length === 0) return plan

  const context = [
    `Original goal: ${plan.goal}`,
    `Current observation: ${currentObservation}`,
    `Failed steps: ${failedSteps.map(s => s.description).join(', ')}`,
    `Remaining steps: ${pendingSteps.map(s => s.description).join(', ')}`,
  ].join('\n')

  // Replace failed steps with a single recovery step
  const recoveryStep: PlanStep = {
    id: `step_recovery_${Date.now()}`,
    description: `Recover from failure: ${currentObservation.slice(0, 80)}`,
    expectedOutcome: 'Recovery complete, proceeding with plan',
    estimatedMs: 2000,
    dependsOn: [],
    status: 'pending',
  }

  plan.steps = [
    ...plan.steps.filter(s => s.status === 'done'),
    recoveryStep,
    ...pendingSteps.map(s => ({ ...s, dependsOn: [recoveryStep.id] })),
  ]
  plan.version++
  plan.updatedAt = new Date()

  console.log(`[Planner] Refined plan ${planId} v${plan.version}: ${context.slice(0, 100)}`)

  return plan
}

// ── Get plan ───────────────────────────────────────────────────────
export function getPlan(planId: string): Plan | null {
  return plans.get(planId) ?? null
}

export function getNextStep(planId: string): PlanStep | null {
  const plan = plans.get(planId)
  if (!plan) return null

  for (const step of plan.steps) {
    if (step.status !== 'pending') continue
    const depsOk = step.dependsOn.every(depId => {
      const dep = plan.steps.find(s => s.id === depId)
      return dep?.status === 'done'
    })
    if (depsOk) return step
  }
  return null
}

export function isPlanComplete(planId: string): boolean {
  const plan = plans.get(planId)
  if (!plan) return true
  return plan.steps.every(s => s.status === 'done' || s.status === 'skipped')
}

export function isPlanFailed(planId: string): boolean {
  const plan = plans.get(planId)
  if (!plan) return false
  const failedCount = plan.steps.filter(s => s.status === 'failed').length
  const totalCount = plan.steps.length
  return failedCount > totalCount / 2
}
