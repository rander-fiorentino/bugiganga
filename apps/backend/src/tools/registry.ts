// apps/backend/src/tools/registry.ts
// Tools Registry with schemas, validation and risk levels

export type RiskLevel = 'low' | 'medium' | 'high'
export type ToolCategory = 'navigation' | 'interaction' | 'extraction' | 'wait' | 'scroll' | 'form' | 'storage'

export interface ToolParam {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object'
  required: boolean
  description: string
  example?: string
}

export interface ToolDefinition {
  name: string
  description: string
  category: ToolCategory
  riskLevel: RiskLevel
  estimatedMs: number
  params: ToolParam[]
}

// ── Tool Registry ──────────────────────────────────────────────
const registry = new Map<string, ToolDefinition>()

function register(tool: ToolDefinition): void {
  registry.set(tool.name, tool)
}

// ── Register all tools ──────────────────────────────────────────
register({
  name: 'navigate',
  description: 'Navigate to a URL in the browser',
  category: 'navigation',
  riskLevel: 'low',
  estimatedMs: 2000,
  params: [
    { name: 'url', type: 'string', required: true, description: 'URL to navigate to', example: 'https://example.com' },
  ],
})

register({
  name: 'click',
  description: 'Click on an element identified by CSS selector',
  category: 'interaction',
  riskLevel: 'medium',
  estimatedMs: 500,
  params: [
    { name: 'selector', type: 'string', required: true, description: 'CSS selector of element to click', example: 'button#submit' },
    { name: 'timeout', type: 'number', required: false, description: 'Max wait time in ms', example: '5000' },
  ],
})

register({
  name: 'type_text',
  description: 'Type text into an input element',
  category: 'form',
  riskLevel: 'low',
  estimatedMs: 800,
  params: [
    { name: 'selector', type: 'string', required: true, description: 'CSS selector of input element', example: 'input[name="email"]' },
    { name: 'text', type: 'string', required: true, description: 'Text to type', example: 'user@example.com' },
    { name: 'clear', type: 'boolean', required: false, description: 'Clear field before typing', example: 'true' },
  ],
})

register({
  name: 'extract_text',
  description: 'Extract text content from elements matching a selector',
  category: 'extraction',
  riskLevel: 'low',
  estimatedMs: 300,
  params: [
    { name: 'selector', type: 'string', required: true, description: 'CSS selector', example: 'h1.title' },
    { name: 'multiple', type: 'boolean', required: false, description: 'Extract all matching elements', example: 'false' },
  ],
})

register({
  name: 'extract_links',
  description: 'Extract all links from the current page or a scoped element',
  category: 'extraction',
  riskLevel: 'low',
  estimatedMs: 300,
  params: [
    { name: 'scope', type: 'string', required: false, description: 'CSS selector to scope extraction', example: 'nav' },
    { name: 'pattern', type: 'string', required: false, description: 'Regex pattern to filter URLs', example: '/products/' },
  ],
})

register({
  name: 'scroll',
  description: 'Scroll the page or an element',
  category: 'scroll',
  riskLevel: 'low',
  estimatedMs: 500,
  params: [
    { name: 'direction', type: 'string', required: false, description: 'up | down | left | right | top | bottom', example: 'down' },
    { name: 'amount', type: 'number', required: false, description: 'Pixels to scroll', example: '500' },
    { name: 'selector', type: 'string', required: false, description: 'Scroll specific element', example: '.scroll-container' },
  ],
})

register({
  name: 'wait_for_element',
  description: 'Wait until an element appears in the DOM',
  category: 'wait',
  riskLevel: 'low',
  estimatedMs: 3000,
  params: [
    { name: 'selector', type: 'string', required: true, description: 'CSS selector to wait for', example: '.loading-complete' },
    { name: 'timeout', type: 'number', required: false, description: 'Max wait in ms', example: '10000' },
    { name: 'state', type: 'string', required: false, description: 'visible | hidden | attached', example: 'visible' },
  ],
})

register({
  name: 'wait_ms',
  description: 'Wait a fixed number of milliseconds',
  category: 'wait',
  riskLevel: 'low',
  estimatedMs: 1000,
  params: [
    { name: 'ms', type: 'number', required: true, description: 'Milliseconds to wait', example: '1000' },
  ],
})

register({
  name: 'screenshot',
  description: 'Take a screenshot of the current page state',
  category: 'extraction',
  riskLevel: 'low',
  estimatedMs: 500,
  params: [
    { name: 'selector', type: 'string', required: false, description: 'Capture specific element', example: '.chart-container' },
    { name: 'fullPage', type: 'boolean', required: false, description: 'Capture full page', example: 'false' },
  ],
})

register({
  name: 'evaluate_js',
  description: 'Execute JavaScript in the browser context and return result',
  category: 'extraction',
  riskLevel: 'high',
  estimatedMs: 500,
  params: [
    { name: 'script', type: 'string', required: true, description: 'JS code to execute', example: 'document.title' },
  ],
})

register({
  name: 'select_option',
  description: 'Select an option from a <select> element',
  category: 'form',
  riskLevel: 'low',
  estimatedMs: 300,
  params: [
    { name: 'selector', type: 'string', required: true, description: 'CSS selector of select element', example: 'select#country' },
    { name: 'value', type: 'string', required: true, description: 'Option value or text to select', example: 'BR' },
  ],
})

register({
  name: 'read_page_content',
  description: 'Read the full text content and structure of the current page',
  category: 'extraction',
  riskLevel: 'low',
  estimatedMs: 400,
  params: [
    { name: 'includeHidden', type: 'boolean', required: false, description: 'Include hidden elements', example: 'false' },
    { name: 'maxLength', type: 'number', required: false, description: 'Max characters to return', example: '5000' },
  ],
})

// ── Public API ───────────────────────────────────────────────────
export function getTool(name: string): ToolDefinition | null {
  return registry.get(name) ?? null
}

export function getAllTools(): ToolDefinition[] {
  return Array.from(registry.values())
}

export function getToolsByCategory(category: ToolCategory): ToolDefinition[] {
  return getAllTools().filter(t => t.category === category)
}

export function getToolsByRisk(riskLevel: RiskLevel): ToolDefinition[] {
  return getAllTools().filter(t => t.riskLevel === riskLevel)
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export function validateToolParams(
  toolName: string,
  params: Record<string, unknown>
): ValidationResult {
  const tool = registry.get(toolName)
  if (!tool) {
    return { valid: false, errors: [`Unknown tool: ${toolName}`] }
  }

  const errors: string[] = []

  for (const paramDef of tool.params) {
    const value = params[paramDef.name]

    if (paramDef.required && (value === undefined || value === null || value === '')) {
      errors.push(`Required parameter '${paramDef.name}' is missing`)
      continue
    }

    if (value === undefined || value === null) continue

    const actualType = typeof value
    if (paramDef.type !== 'object' && actualType !== paramDef.type) {
      errors.push(`Parameter '${paramDef.name}' must be ${paramDef.type}, got ${actualType}`)
    }
  }

  return { valid: errors.length === 0, errors }
}

// ── Anthropic tool schema format ────────────────────────────────
export function toAnthropicSchema(tool: ToolDefinition): Record<string, unknown> {
  const properties: Record<string, unknown> = {}
  const required: string[] = []

  for (const p of tool.params) {
    properties[p.name] = {
      type: p.type === 'object' ? 'object' : p.type,
      description: p.description,
    }
    if (p.required) required.push(p.name)
  }

  return {
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: 'object',
      properties,
      required,
    },
  }
}

export function getAllAnthropicSchemas(): Record<string, unknown>[] {
  return getAllTools().map(toAnthropicSchema)
}
