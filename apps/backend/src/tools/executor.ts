import type { ToolResult, ToolInput } from '@bugiganga/types'
import { summarizePage, getVisibleText, getInteractiveElements, extractContacts } from './readTools'
import { clickElement, typeIntoField, fillFormFields, navigateToUrl } from './actionTools'
import { extractTableData, extractKeyEntities, extractPageSummary } from './extractionTools'

// ============================================================
// Tool registry
// ============================================================

type ToolFn = (input: ToolInput) => Promise<ToolResult>

const TOOL_REGISTRY: Record<string, ToolFn> = {
  // Read tools
  summarizePage: summarizePage as ToolFn,
  getVisibleText: getVisibleText as ToolFn,
  getInteractiveElements: getInteractiveElements as ToolFn,
  extractContacts: extractContacts as ToolFn,

  // Action tools
  clickElement: clickElement as ToolFn,
  typeIntoField: typeIntoField as ToolFn,
  fillFormFields: fillFormFields as ToolFn,
  navigateToUrl: navigateToUrl as ToolFn,

  // Extraction tools
  extractTableData: extractTableData as ToolFn,
  extractKeyEntities: extractKeyEntities as ToolFn,
  extractPageSummary: extractPageSummary as ToolFn,
}

// Aliases
TOOL_REGISTRY['extract_contacts'] = extractContacts as ToolFn
TOOL_REGISTRY['summarize_page'] = summarizePage as ToolFn
TOOL_REGISTRY['get_visible_text'] = getVisibleText as ToolFn
TOOL_REGISTRY['click_element'] = clickElement as ToolFn
TOOL_REGISTRY['type_into_field'] = typeIntoField as ToolFn
TOOL_REGISTRY['fill_form_fields'] = fillFormFields as ToolFn
TOOL_REGISTRY['navigate_to_url'] = navigateToUrl as ToolFn
TOOL_REGISTRY['extract_table_data'] = extractTableData as ToolFn
TOOL_REGISTRY['extract_key_entities'] = extractKeyEntities as ToolFn

// ============================================================
// Tool executor
// ============================================================

export async function runTool(name: string, input: ToolInput): Promise<ToolResult> {
  const tool = TOOL_REGISTRY[name]

  if (!tool) {
    return {
      success: false,
      error: `Unknown tool: "${name}". Available tools: ${Object.keys(TOOL_REGISTRY).filter((k) => !k.includes('_')).join(', ')}`,
    }
  }

  try {
    console.log(`[executor] Running tool: ${name}`)
    const startTime = Date.now()
    const result = await tool(input)
    console.log(`[executor] Tool ${name} completed in ${Date.now() - startTime}ms`)
    return result
  } catch (err) {
    console.error(`[executor] Tool ${name} threw an error:`, err)
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ============================================================
// Tool listing
// ============================================================

export function listTools(): string[] {
  return [...new Set(Object.keys(TOOL_REGISTRY))]
}

export function hasTooll(name: string): boolean {
  return name in TOOL_REGISTRY
}
