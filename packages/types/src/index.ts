// ============================================================
// Page Context Types
// ============================================================

export interface PageContext {
  url: string
  title: string
  mainContent: string
  htmlSnapshot?: string
  interactiveElements: InteractiveElement[]
  forms: FormElement[]
  links: LinkElement[]
  tables: TableElement[]
  tabs?: TabInfo[]
  timestamp: number
}

export interface InteractiveElement {
  type: 'input' | 'button' | 'link' | 'select' | 'textarea' | 'checkbox' | 'radio'
  selector: string
  label?: string
  placeholder?: string
  value?: string
  href?: string
  text?: string
  visible: boolean
  boundingBox?: { x: number; y: number; width: number; height: number }
}

export interface FormElement {
  selector: string
  action?: string
  method?: string
  fields: InputElement[]
  submitButton?: ButtonElement
}

export interface InputElement {
  selector: string
  name?: string
  id?: string
  type: string
  label?: string
  placeholder?: string
  required: boolean
  value?: string
  options?: string[] // for select elements
}

export interface ButtonElement {
  selector: string
  text: string
  type?: 'submit' | 'button' | 'reset'
  disabled?: boolean
}

export interface LinkElement {
  selector: string
  text: string
  href: string
  isExternal: boolean
}

export interface TableElement {
  selector: string
  headers: string[]
  rows: string[][]
  caption?: string
}

export interface TabInfo {
  id: number
  url: string
  title: string
  active: boolean
  index: number
}

// ============================================================
// Agent I/O Types
// ============================================================

export interface AgentInput {
  message: string
  sessionId: string
  pageContext: PageContext
  conversationHistory?: Message[]
}

export interface AgentOutput {
  status: 'completed' | 'awaiting_confirmation' | 'error' | 'thinking'
  result?: AgentResult
  plan?: Plan
  message?: string
  error?: string
}

export interface AgentResult {
  response: string
  actions: ActionRecord[]
  notes: string[]
  toolsUsed: string[]
  data?: Record<string, unknown>
}

export interface ActionRecord {
  tool: string
  input: Record<string, unknown>
  output: unknown
  timestamp: number
  success: boolean
  error?: string
}

// ============================================================
// Intent Types
// ============================================================

export type IntentType =
  | 'summarize_page'
  | 'extract_contacts'
  | 'fill_form'
  | 'click_element'
  | 'navigate'
  | 'extract_data'
  | 'answer_question'
  | 'search_page'
  | 'take_screenshot'
  | 'multi_step_task'
  | 'unknown'

export interface Intent {
  type: IntentType
  confidence: number
  details?: string
  requiredTools?: string[]
}

// ============================================================
// Plan Types
// ============================================================

export interface Plan {
  id: string
  intent: Intent
  steps: PlanStep[]
  requiresConfirmation: boolean
  estimatedSteps: number
  description: string
  createdAt: number
}

export interface PlanStep {
  id: string
  order: number
  tool: string
  description: string
  input: Record<string, unknown>
  dependsOn?: string[]
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  result?: unknown
  error?: string
}

// ============================================================
// Tool Types
// ============================================================

export interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
  actionInstruction?: ContentScriptAction
}

export interface ContentScriptAction {
  type: 'click' | 'type' | 'fill' | 'navigate' | 'scroll' | 'screenshot'
  selector?: string
  value?: string
  url?: string
  fields?: FieldFill[]
}

export interface FieldFill {
  selector: string
  value: string
  label?: string
}

// ============================================================
// Chat / Message Types
// ============================================================

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  metadata?: MessageMetadata
}

export interface MessageMetadata {
  planId?: string
  toolsUsed?: string[]
  pageUrl?: string
  isError?: boolean
}

// ============================================================
// Session Types
// ============================================================

export interface Session {
  id: string
  createdAt: number
  updatedAt: number
  pageUrl?: string
  conversationHistory: Message[]
  memory: SessionMemory
}

export interface SessionMemory {
  sessionId: string
  notes: string[]
  extractedData: Record<string, unknown>
  actions: ActionRecord[]
  preferences: Record<string, unknown>
}

// ============================================================
// Log Types
// ============================================================

export interface Log {
  id: string
  sessionId: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  data?: Record<string, unknown>
  timestamp: number
}

// ============================================================
// Tool Definition Types
// ============================================================

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface ToolInput {
  pageContext?: PageContext
  selector?: string
  text?: string
  url?: string
  query?: string
  fields?: FieldFill[]
  sessionId?: string
  [key: string]: unknown
}
