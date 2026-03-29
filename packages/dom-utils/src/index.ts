// DOM utility functions shared between extension content script and tests.
// These run in the browser context — no Node.js APIs allowed.

import type { InteractiveElement, FormElement, InputElement, ButtonElement, LinkElement, TableElement } from '@bugiganga/types'

// ============================================================
// Selector Generation
// ============================================================

/**
 * Generate a unique CSS selector for a DOM element.
 * Tries (in order): id, data-testid, name+type combo, nth-of-type path.
 */
export function generateSelector(el: Element): string {
  // 1. ID
  if (el.id) {
    return `#${CSS.escape(el.id)}`
  }

  // 2. data-testid
  const testId = el.getAttribute('data-testid')
  if (testId) {
    return `[data-testid="${testId}"]`
  }

  // 3. name attribute (for inputs/forms)
  const name = el.getAttribute('name')
  if (name && el.tagName) {
    const nameSelector = `${el.tagName.toLowerCase()}[name="${name}"]`
    if (document.querySelectorAll(nameSelector).length === 1) {
      return nameSelector
    }
  }

  // 4. Build path from root
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
      const siblings = Array.from(parent.children).filter(
        (c) => c.tagName === current!.tagName
      )
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1
        part += `:nth-of-type(${index})`
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

/**
 * Returns true if the element is visible in the viewport.
 */
export function isVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false

  const style = window.getComputedStyle(el)
  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    style.opacity === '0'
  ) {
    return false
  }

  const rect = el.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return false

  // Check if it's within the viewport (with some tolerance)
  return (
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < (window.innerHeight || document.documentElement.clientHeight) * 2 &&
    rect.left < (window.innerWidth || document.documentElement.clientWidth)
  )
}

/**
 * Returns true if the element is in the DOM and not hidden.
 */
export function isInteractable(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false
  if ((el as HTMLInputElement).disabled) return false
  if ((el as HTMLInputElement).readOnly) return false
  return isVisible(el)
}

// ============================================================
// Element Extraction
// ============================================================

export function extractInteractiveElements(root: Document | Element = document): InteractiveElement[] {
  const elements: InteractiveElement[] = []
  const selectors = 'input, button, a[href], select, textarea, [role="button"], [onclick]'

  root.querySelectorAll(selectors).forEach((el) => {
    if (!(el instanceof HTMLElement)) return

    const visible = isVisible(el)
    const rect = el.getBoundingClientRect()
    const tag = el.tagName.toLowerCase()

    let type: InteractiveElement['type'] = 'button'
    if (tag === 'input') type = (el as HTMLInputElement).type as InteractiveElement['type'] || 'input'
    else if (tag === 'a') type = 'link'
    else if (tag === 'button') type = 'button'
    else if (tag === 'select') type = 'select' as InteractiveElement['type']
    else if (tag === 'textarea') type = 'textarea' as InteractiveElement['type']

    elements.push({
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

  return elements
}

export function extractForms(root: Document | Element = document): FormElement[] {
  const forms: FormElement[] = []

  root.querySelectorAll('form').forEach((form) => {
    const fields: InputElement[] = []

    form.querySelectorAll('input, select, textarea').forEach((field) => {
      if (!(field instanceof HTMLElement)) return
      const inputEl = field as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      const options =
        field.tagName === 'select'
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

  return forms
}

export function extractLinks(root: Document | Element = document): LinkElement[] {
  const links: LinkElement[] = []
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : ''

  root.querySelectorAll('a[href]').forEach((a) => {
    if (!(a instanceof HTMLAnchorElement)) return
    const href = a.href
    if (!href || href.startsWith('javascript:')) return

    let isExternal = false
    try {
      isExternal = new URL(href).origin !== currentOrigin
    } catch {
      isExternal = false
    }

    links.push({
      selector: generateSelector(a),
      text: a.innerText?.trim().slice(0, 200) || a.getAttribute('aria-label') || '',
      href,
      isExternal,
    })
  })

  return links
}

export function extractTables(root: Document | Element = document): TableElement[] {
  const tables: TableElement[] = []

  root.querySelectorAll('table').forEach((table) => {
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

  return tables
}

// ============================================================
// Helpers
// ============================================================

function getLabel(el: HTMLElement): string | undefined {
  // Check aria-label
  const ariaLabel = el.getAttribute('aria-label')
  if (ariaLabel) return ariaLabel

  // Check associated <label>
  const id = el.id
  if (id) {
    const label = document.querySelector(`label[for="${id}"]`)
    if (label) return (label as HTMLElement).innerText?.trim()
  }

  // Check wrapping label
  const parent = el.closest('label')
  if (parent) {
    const clone = parent.cloneNode(true) as HTMLElement
    const input = clone.querySelector('input, select, textarea')
    if (input) clone.removeChild(input)
    const text = clone.innerText?.trim()
    if (text) return text
  }

  // Check placeholder
  const placeholder = el.getAttribute('placeholder')
  if (placeholder) return placeholder

  return undefined
}

export function getMainContent(maxLength = 5000): string {
  // Try semantic main element first
  const main = document.querySelector('main, [role="main"], article, #content, .content')
  const source = main || document.body

  // Get text content, strip excessive whitespace
  const text = (source as HTMLElement).innerText || ''
  return text.replace(/\s+/g, ' ').trim().slice(0, maxLength)
}
