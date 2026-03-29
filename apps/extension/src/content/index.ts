// Content script — runs in the context of every page
// Handles DOM inspection and interaction commands from the background service worker

import type {
  PageContext,
  InteractiveElement,
  FormElement,
  InputElement,
  ButtonElement,
  LinkElement,
  TableElement,
  ContentScriptAction,
  FieldFill,
} from '@bugiganga/types'

// ============================================================
// Selector generation
// ============================================================

function generateSelector(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`

  const testId = el.getAttribute('data-testid')
  if (testId) return `[data-testid="${CSS.escape(testId)}"]`

  const name = el.getAttribute('name')
  if (name) {
    const nameSelector = `${el.tagName.toLowerCase()}[name="${name}"]`
    if (document.querySelectorAll(nameSelector).length === 1) return nameSelector
  }

  return buildSelectorPath(el)
}

function buildSelectorPath(el: Element): string {
  const parts: string[] = []
  let current: Element | null = el

  while (current && current !== document.body) {
    let part = current.tagName.toLowerCase()
    if (current.id) {
      parts.unshift(`#${CSS.escape(current.id)}`)
      break
    }
    const parent = current.parentElement
    if (parent) {
      const siblings = Array.from(parent.children).filter((c) => c.tagName === current!.tagName)
      if (siblings.length > 1) {
        part += `:nth-of-type(${siblings.indexOf(current) + 1})`
      }
    }
    parts.unshift(part)
    current = current.parentElement
  }

  return parts.join(' > ')
}

// ============================================================
// Visibility
// ============================================================

function isVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false
  const style = window.getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false
  const rect = el.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return false
  return rect.bottom > 0 && rect.right > 0
}

// ============================================================
// Label extraction
// ============================================================

function getLabel(el: HTMLElement): string | undefined {
  const ariaLabel = el.getAttribute('aria-label')
  if (ariaLabel) return ariaLabel

  if (el.id) {
    const label = document.querySelector(`label[for="${el.id}"]`)
    if (label) return (label as HTMLElement).innerText?.trim()
  }

  const parentLabel = el.closest('label')
  if (parentLabel) {
    const clone = parentLabel.cloneNode(true) as HTMLElement
    const input = clone.querySelector('input, select, textarea')
    if (input) clone.removeChild(input)
    const text = clone.innerText?.trim()
    if (text) return text
  }

  return el.getAttribute('placeholder') || undefined
}

// ============================================================
// Page Context Extraction
// ============================================================

function extractPageContext(): PageContext {
  // Interactive elements
  const interactiveElements: InteractiveElement[] = []
  document.querySelectorAll('input, button, a[href], select, textarea, [role="button"]').forEach((el) => {
    if (!(el instanceof HTMLElement)) return
    const visible = isVisible(el)
    const rect = el.getBoundingClientRect()
    const tag = el.tagName.toLowerCase()
    let type: InteractiveElement['type'] = 'button'
    if (tag === 'input') type = ((el as HTMLInputElement).type || 'input') as InteractiveElement['type']
    else if (tag === 'a') type = 'link'
    else if (tag === 'select') type = 'select' as InteractiveElement['type']
    else if (tag === 'textarea') type = 'textarea' as InteractiveElement['type']

    interactiveElements.push({
      type,
      selector: generateSelector(el),
      label: getLabel(el),
      placeholder: (el as HTMLInputElement).placeholder || undefined,
      value: (el as HTMLInputElement).value || undefined,
      href: (el as HTMLAnchorElement).href || undefined,
      text: el.innerText?.trim().slice(0, 100) || undefined,
      visible,
      boundingBox: visible
        ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        : undefined,
    })
  })

  // Forms
  const forms: FormElement[] = []
  document.querySelectorAll('form').forEach((form) => {
    const fields: InputElement[] = []
    form.querySelectorAll('input, select, textarea').forEach((field) => {
      if (!(field instanceof HTMLElement)) return
      const inputEl = field as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      const options =
        field.tagName === 'SELECT'
          ? Array.from((field as HTMLSelectElement).options).map((o) => o.text)
          : undefined
      fields.push({
        selector: generateSelector(field),
        name: inputEl.name || undefined,
        id: field.id || undefined,
        type: (inputEl as HTMLInputElement).type || field.tagName.toLowerCase(),
        label: getLabel(field),
        placeholder: (inputEl as HTMLInputElement).placeholder || undefined,
        required: (inputEl as HTMLInputElement).required || false,
        value: inputEl.value || undefined,
        options,
      })
    })

    const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]')
    let submitButton: ButtonElement | undefined
    if (submitBtn instanceof HTMLElement) {
      submitButton = {
        selector: generateSelector(submitBtn),
        text: (submitBtn as HTMLButtonElement).innerText?.trim() || 'Submit',
        type: 'submit',
      }
    }

    forms.push({
      selector: generateSelector(form),
      action: form.action || undefined,
      method: form.method || undefined,
      fields,
      submitButton,
    })
  })

  // Links
  const links: LinkElement[] = []
  document.querySelectorAll('a[href]').forEach((a) => {
    if (!(a instanceof HTMLAnchorElement)) return
    const href = a.href
    if (!href || href.startsWith('javascript:')) return
    let isExternal = false
    try {
      isExternal = new URL(href).origin !== window.location.origin
    } catch {}
    links.push({
      selector: generateSelector(a),
      text: a.innerText?.trim().slice(0, 200) || a.getAttribute('aria-label') || '',
      href,
      isExternal,
    })
  })

  // Tables
  const tables: TableElement[] = []
  document.querySelectorAll('table').forEach((table) => {
    const headers: string[] = []
    const rows: string[][] = []
    table.querySelectorAll('thead th, thead td').forEach((th) => {
      headers.push((th as HTMLElement).innerText?.trim() || '')
    })
    table.querySelectorAll('tbody tr').forEach((row) => {
      const cells: string[] = []
      row.querySelectorAll('td, th').forEach((cell) => {
        cells.push((cell as HTMLElement).innerText?.trim() || '')
      })
      if (cells.length > 0) rows.push(cells)
    })
    const caption = table.querySelector('caption')
    tables.push({
      selector: generateSelector(table),
      headers,
      rows,
      caption: caption?.innerText?.trim() || undefined,
    })
  })

  // Main content text
  const mainEl =
    document.querySelector('main, [role="main"], article, #content, .content') || document.body
  const mainContent = (mainEl as HTMLElement).innerText?.replace(/\s+/g, ' ').trim().slice(0, 5000) || ''

  return {
    url: window.location.href,
    title: document.title,
    mainContent,
    interactiveElements,
    forms,
    links,
    tables,
    timestamp: Date.now(),
  }
}

// ============================================================
// DOM Actions
// ============================================================

async function clickElement(selector: string): Promise<{ success: boolean; error?: string }> {
  try {
    const el = document.querySelector(selector)
    if (!el) return { success: false, error: `Element not found: ${selector}` }
    if (!(el instanceof HTMLElement)) return { success: false, error: 'Element is not an HTML element' }
    el.focus()
    el.click()
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

async function typeIntoField(
  selector: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const el = document.querySelector(selector)
    if (!el) return { success: false, error: `Element not found: ${selector}` }
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
      return { success: false, error: 'Element is not an input or textarea' }
    }
    el.focus()
    el.value = text
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

async function fillFormFields(
  fields: FieldFill[]
): Promise<{ success: boolean; filled: number; errors: string[] }> {
  let filled = 0
  const errors: string[] = []

  for (const field of fields) {
    const result = await typeIntoField(field.selector, field.value)
    if (result.success) {
      filled++
    } else {
      errors.push(`${field.selector}: ${result.error}`)
    }
  }

  return { success: errors.length === 0, filled, errors }
}

async function scrollToElement(selector: string): Promise<{ success: boolean; error?: string }> {
  try {
    const el = document.querySelector(selector)
    if (!el) return { success: false, error: `Element not found: ${selector}` }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

// ============================================================
// Message Listener
// ============================================================

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const { type, payload } = message

  switch (type) {
    case 'GET_PAGE_CONTEXT': {
      try {
        const ctx = extractPageContext()
        sendResponse({ success: true, pageContext: ctx })
      } catch (err) {
        sendResponse({ success: false, error: String(err) })
      }
      return true
    }

    case 'CLICK_ELEMENT': {
      clickElement(payload?.selector || '').then(sendResponse)
      return true
    }

    case 'TYPE_INTO_FIELD': {
      typeIntoField(payload?.selector || '', payload?.text || '').then(sendResponse)
      return true
    }

    case 'FILL_FORM_FIELDS': {
      fillFormFields(payload?.fields || []).then(sendResponse)
      return true
    }

    case 'SCROLL_TO': {
      scrollToElement(payload?.selector || '').then(sendResponse)
      return true
    }

    case 'NAVIGATE': {
      if (payload?.url) {
        window.location.href = payload.url
        sendResponse({ success: true })
      } else {
        sendResponse({ success: false, error: 'No URL provided' })
      }
      return true
    }

    case 'EXECUTE_ACTION': {
      const action: ContentScriptAction = payload?.action
      if (!action) {
        sendResponse({ success: false, error: 'No action provided' })
        return true
      }

      const executeAction = async () => {
        switch (action.type) {
          case 'click':
            return action.selector ? clickElement(action.selector) : { success: false, error: 'No selector' }
          case 'type':
            return action.selector && action.value !== undefined
              ? typeIntoField(action.selector, action.value)
              : { success: false, error: 'Missing selector or value' }
          case 'fill':
            return action.fields ? fillFormFields(action.fields) : { success: false, error: 'No fields' }
          case 'navigate':
            if (action.url) {
              window.location.href = action.url
              return { success: true }
            }
            return { success: false, error: 'No URL' }
          case 'scroll':
            return action.selector ? scrollToElement(action.selector) : { success: false, error: 'No selector' }
          default:
            return { success: false, error: `Unknown action type: ${action.type}` }
        }
      }

      executeAction().then(sendResponse)
      return true
    }

    default:
      return false
  }
})

// Notify background that content script is ready
chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY', url: window.location.href }).catch(() => {
  // Background may not be ready yet, that's fine
})

console.log('[Bugiganga] Content script loaded on', window.location.href)
