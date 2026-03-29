import type { PageContext, ToolResult, FieldFill, ContentScriptAction } from '@bugiganga/types'

// ============================================================
// clickElement
// Returns an action instruction for the content script to execute
// ============================================================

export async function clickElement(input: {
  selector: string
  pageContext?: PageContext
}): Promise<ToolResult> {
  const { selector, pageContext } = input

  if (!selector) {
    return { success: false, error: 'selector is required for clickElement' }
  }

  // Verify element exists in page context
  if (pageContext) {
    const found =
      pageContext.interactiveElements.some((e) => e.selector === selector) ||
      pageContext.links.some((l) => l.selector === selector)

    if (!found) {
      // Not in context but we'll still try — it might be present in the live DOM
      console.warn(`[clickElement] Selector not found in context: ${selector}`)
    }
  }

  const action: ContentScriptAction = {
    type: 'click',
    selector,
  }

  return {
    success: true,
    data: { selector, action: 'click', message: `Will click element: ${selector}` },
    actionInstruction: action,
  }
}

// ============================================================
// typeIntoField
// ============================================================

export async function typeIntoField(input: {
  selector: string
  text: string
  pageContext?: PageContext
}): Promise<ToolResult> {
  const { selector, text } = input

  if (!selector) {
    return { success: false, error: 'selector is required for typeIntoField' }
  }

  if (text === undefined || text === null) {
    return { success: false, error: 'text is required for typeIntoField' }
  }

  const action: ContentScriptAction = {
    type: 'type',
    selector,
    value: text,
  }

  return {
    success: true,
    data: {
      selector,
      text,
      message: `Will type "${text.slice(0, 30)}${text.length > 30 ? '...' : ''}" into ${selector}`,
    },
    actionInstruction: action,
  }
}

// ============================================================
// fillFormFields
// ============================================================

export async function fillFormFields(input: {
  fields: FieldFill[]
  pageContext?: PageContext
}): Promise<ToolResult> {
  const { fields, pageContext } = input

  if (!fields || fields.length === 0) {
    // Auto-detect fields from page context if none provided
    if (pageContext?.forms && pageContext.forms.length > 0) {
      const autoFields = inferFormFields(pageContext)
      if (autoFields.length === 0) {
        return { success: false, error: 'No form fields found on the page' }
      }

      const action: ContentScriptAction = {
        type: 'fill',
        fields: autoFields,
      }

      return {
        success: true,
        data: {
          fields: autoFields,
          fieldCount: autoFields.length,
          message: `Will fill ${autoFields.length} field(s)`,
          autoDetected: true,
        },
        actionInstruction: action,
      }
    }

    return { success: false, error: 'No fields provided and no forms found on page' }
  }

  const action: ContentScriptAction = {
    type: 'fill',
    fields,
  }

  return {
    success: true,
    data: {
      fields,
      fieldCount: fields.length,
      message: `Will fill ${fields.length} field(s)`,
    },
    actionInstruction: action,
  }
}

// ============================================================
// navigateToUrl
// ============================================================

export async function navigateToUrl(input: {
  url: string
  pageContext?: PageContext
}): Promise<ToolResult> {
  const { url } = input

  if (!url) {
    return { success: false, error: 'url is required for navigateToUrl' }
  }

  // Validate URL
  let validUrl = url
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    validUrl = `https://${url}`
  }

  try {
    new URL(validUrl)
  } catch {
    return { success: false, error: `Invalid URL: ${url}` }
  }

  const action: ContentScriptAction = {
    type: 'navigate',
    url: validUrl,
  }

  return {
    success: true,
    data: { url: validUrl, message: `Will navigate to ${validUrl}` },
    actionInstruction: action,
  }
}

// ============================================================
// Helpers
// ============================================================

function inferFormFields(pageContext: PageContext): FieldFill[] {
  const fields: FieldFill[] = []

  for (const form of pageContext.forms) {
    for (const field of form.fields) {
      // Skip hidden, submit, and button fields
      if (['hidden', 'submit', 'button', 'reset', 'image', 'file'].includes(field.type)) continue
      if (!field.selector) continue

      // Use placeholder or label as the value hint
      const label = field.label || field.placeholder || field.name || field.type
      fields.push({
        selector: field.selector,
        value: '', // Will need to be filled by the user/AI
        label,
      })
    }
  }

  return fields
}
