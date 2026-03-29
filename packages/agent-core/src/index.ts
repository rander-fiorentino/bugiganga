import type {
  AgentInput,
  AgentOutput,
  Plan,
  PlanStep,
  Intent,
  Message,
  Session,
  SessionMemory,
} from '@bugiganga/types'

// ============================================================
// Session helpers
// ============================================================

export function createEmptySession(id: string): Session {
  return {
    id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    conversationHistory: [],
    memory: createEmptyMemory(id),
  }
}

export function createEmptyMemory(sessionId: string): SessionMemory {
  return {
    sessionId,
    notes: [],
    extractedData: {},
    actions: [],
    preferences: {},
  }
}

// ============================================================
// Message helpers
// ============================================================

export function createMessage(
  role: Message['role'],
  content: string,
  metadata?: Message['metadata']
): Message {
  return {
    id: generateId(),
    role,
    content,
    timestamp: Date.now(),
    metadata,
  }
}

// ============================================================
// Plan helpers
// ============================================================

export function createPlanStep(
  order: number,
  tool: string,
  description: string,
  input: Record<string, unknown>,
  dependsOn?: string[]
): PlanStep {
  return {
    id: generateId(),
    order,
    tool,
    description,
    input,
    dependsOn,
    status: 'pending',
  }
}

export function isPlanComplete(plan: Plan): boolean {
  return plan.steps.every(
    (step) => step.status === 'completed' || step.status === 'skipped'
  )
}

export function hasPlanFailed(plan: Plan): boolean {
  return plan.steps.some((step) => step.status === 'failed')
}

export function getNextPendingStep(plan: Plan): PlanStep | undefined {
  return plan.steps.find((step) => step.status === 'pending')
}

// ============================================================
// Intent helpers
// ============================================================

export function formatIntentForDisplay(intent: Intent): string {
  const labels: Record<string, string> = {
    summarize_page: 'Summarize Page',
    extract_contacts: 'Extract Contacts',
    fill_form: 'Fill Form',
    click_element: 'Click Element',
    navigate: 'Navigate',
    extract_data: 'Extract Data',
    answer_question: 'Answer Question',
    search_page: 'Search Page',
    take_screenshot: 'Take Screenshot',
    multi_step_task: 'Multi-step Task',
    unknown: 'Unknown',
  }
  return labels[intent.type] ?? intent.type
}

// ============================================================
// Conversation helpers
// ============================================================

export function trimConversationHistory(
  history: Message[],
  maxMessages = 20
): Message[] {
  if (history.length <= maxMessages) return history
  // Always keep system messages + most recent messages
  const systemMessages = history.filter((m) => m.role === 'system')
  const nonSystemMessages = history.filter((m) => m.role !== 'system')
  const trimmed = nonSystemMessages.slice(-maxMessages)
  return [...systemMessages, ...trimmed]
}

export function buildContextSummary(memory: SessionMemory): string {
  const parts: string[] = []

  if (memory.notes.length > 0) {
    parts.push(`Notes: ${memory.notes.slice(-5).join('; ')}`)
  }

  const dataKeys = Object.keys(memory.extractedData)
  if (dataKeys.length > 0) {
    parts.push(`Extracted data keys: ${dataKeys.join(', ')}`)
  }

  if (memory.actions.length > 0) {
    const recentActions = memory.actions.slice(-3).map((a) => a.tool)
    parts.push(`Recent actions: ${recentActions.join(', ')}`)
  }

  return parts.join('\n')
}

// ============================================================
// Utility
// ============================================================

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function truncate(text: string, maxLength = 500): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

// Re-export types for convenience
export type {
  AgentInput,
  AgentOutput,
  Plan,
  PlanStep,
  Intent,
  Message,
  Session,
  SessionMemory,
}
