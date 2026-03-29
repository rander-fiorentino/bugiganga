// Shared constants and config

export const BACKEND_URL = process.env.VITE_BACKEND_URL || 'http://localhost:3000'

export const INTENT_LABELS: Record<string, string> = {
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

export const TOOL_LABELS: Record<string, string> = {
  summarizePage: 'Summarize Page',
  getVisibleText: 'Get Visible Text',
  getInteractiveElements: 'Get Elements',
  extractContacts: 'Extract Contacts',
  extractTableData: 'Extract Tables',
  extractKeyEntities: 'Extract Entities',
  extractPageSummary: 'Extract Summary',
  clickElement: 'Click Element',
  typeIntoField: 'Type Into Field',
  fillFormFields: 'Fill Form',
  navigateToUrl: 'Navigate',
}

export const MAX_CONVERSATION_HISTORY = 20
export const MAX_PAGE_CONTENT_LENGTH = 5000
export const REQUEST_TIMEOUT_MS = 30000
