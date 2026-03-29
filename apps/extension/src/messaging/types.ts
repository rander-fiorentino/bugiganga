// Message type definitions for extension internal messaging

import type { PageContext, ContentScriptAction, FieldFill } from '@bugiganga/types'

// ============================================================
// Message types (string enum)
// ============================================================

export const MessageType = {
  // Background <-> Sidebar
  AGENT_REQUEST: 'AGENT_REQUEST',
  AGENT_RESPONSE: 'AGENT_RESPONSE',
  GET_PAGE_CONTEXT: 'GET_PAGE_CONTEXT',
  GET_SESSION: 'GET_SESSION',
  SAVE_MEMORY: 'SAVE_MEMORY',

  // Background <-> Content Script
  EXECUTE_CONTENT_ACTION: 'EXECUTE_CONTENT_ACTION',
  CLICK_ELEMENT: 'CLICK_ELEMENT',
  TYPE_INTO_FIELD: 'TYPE_INTO_FIELD',
  FILL_FORM_FIELDS: 'FILL_FORM_FIELDS',
  SCROLL_TO: 'SCROLL_TO',
  NAVIGATE: 'NAVIGATE',
  EXECUTE_ACTION: 'EXECUTE_ACTION',

  // Content Script -> Background
  CONTENT_SCRIPT_READY: 'CONTENT_SCRIPT_READY',
} as const

export type MessageType = (typeof MessageType)[keyof typeof MessageType]

// ============================================================
// Message payloads
// ============================================================

export interface AgentRequestPayload {
  message: string
  sessionId?: string
  pageContext?: PageContext | null
  conversationHistory?: Array<{ role: string; content: string }>
}

export interface AgentResponsePayload {
  status: 'completed' | 'error' | 'awaiting_confirmation'
  result?: { response: string; toolsUsed?: string[] }
  error?: string
}

export interface GetPageContextPayload {
  tabId?: number
}

export interface GetPageContextResponse {
  success: boolean
  pageContext?: PageContext | null
  error?: string
}

export interface ClickElementPayload {
  selector: string
}

export interface TypeIntoFieldPayload {
  selector: string
  text: string
}

export interface FillFormFieldsPayload {
  fields: FieldFill[]
}

export interface ScrollToPayload {
  selector: string
}

export interface NavigatePayload {
  url: string
}

export interface ExecuteActionPayload {
  action: ContentScriptAction
}

export interface ExecuteActionResponse {
  success: boolean
  error?: string
  filled?: number
  errors?: string[]
}

// ============================================================
// Generic typed message wrapper
// ============================================================

export interface ExtensionMessage<T = unknown> {
  type: MessageType
  payload?: T
}

export interface ExtensionResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}
