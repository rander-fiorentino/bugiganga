import Anthropic from '@anthropic-ai/sdk'
import type { PageContext, ToolResult, InteractiveElement } from '@bugiganga/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ============================================================
// summarizePage
// ============================================================

export async function summarizePage(input: {
  pageContext?: PageContext
  query?: string
  sessionId?: string
}): Promise<ToolResult> {
  const { pageContext, query } = input

  if (!pageContext?.mainContent && !pageContext?.title) {
    return { success: false, error: 'No page content available to summarize' }
  }

  const content = pageContext.mainContent || ''
  const title = pageContext.title || 'Untitled Page'
  const url = pageContext.url || ''

  try {
    const userMessage = query
      ? `Page: ${title}\nURL: ${url}\n\nContent:\n${content.slice(0, 4000)}\n\nTask: ${query}`
      : `Page: ${title}\nURL: ${url}\n\nContent:\n${content.slice(0, 4000)}\n\nProvide a clear, concise summary of this page.`

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system:
        'You are a web page summarizer. Provide concise, useful summaries. Focus on the main topic, key information, and purpose of the page.',
      messages: [{ role: 'user', content: userMessage }],
    })

    const summary = response.content[0].type === 'text' ? response.content[0].text : ''
    return { success: true, data: { summary, title, url } }
  } catch (err) {
    // Fallback: return first 500 chars
    const fallbackSummary = content.slice(0, 500) + (content.length > 500 ? '...' : '')
    return {
      success: true,
      data: { summary: fallbackSummary, title, url, note: 'AI summary unavailable' },
    }
  }
}

// ============================================================
// getVisibleText
// ============================================================

export async function getVisibleText(input: {
  pageContext?: PageContext
  maxLength?: number
}): Promise<ToolResult> {
  const { pageContext, maxLength = 3000 } = input

  if (!pageContext) {
    return { success: false, error: 'No page context provided' }
  }

  const text = pageContext.mainContent?.slice(0, maxLength) || ''
  return {
    success: true,
    data: {
      text,
      length: text.length,
      truncated: (pageContext.mainContent?.length || 0) > maxLength,
    },
  }
}

// ============================================================
// getInteractiveElements
// ============================================================

export async function getInteractiveElements(input: {
  pageContext?: PageContext
  type?: string
  visibleOnly?: boolean
}): Promise<ToolResult> {
  const { pageContext, type, visibleOnly = true } = input

  if (!pageContext) {
    return { success: false, error: 'No page context provided' }
  }

  let elements: InteractiveElement[] = pageContext.interactiveElements || []

  if (visibleOnly) {
    elements = elements.filter((e) => e.visible)
  }

  if (type) {
    elements = elements.filter((e) => e.type === type)
  }

  return {
    success: true,
    data: {
      elements,
      count: elements.length,
      forms: pageContext.forms || [],
      formCount: pageContext.forms?.length || 0,
    },
  }
}

// ============================================================
// extractContacts
// ============================================================

export async function extractContacts(input: {
  pageContext?: PageContext
}): Promise<ToolResult> {
  const { pageContext } = input

  if (!pageContext) {
    return { success: false, error: 'No page context provided' }
  }

  const text = pageContext.mainContent || ''
  const contacts: Array<{ type: string; value: string; context?: string }> = []

  // Email regex
  const emailRegex = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g
  const emails = [...new Set(text.match(emailRegex) || [])]
  emails.forEach((email) => contacts.push({ type: 'email', value: email }))

  // Also check mailto: links
  const mailtoLinks = (pageContext.links || [])
    .filter((l) => l.href?.startsWith('mailto:'))
    .map((l) => l.href.replace('mailto:', '').split('?')[0])
  const uniqueMailtos = [...new Set(mailtoLinks)].filter(
    (e) => !emails.includes(e)
  )
  uniqueMailtos.forEach((email) => contacts.push({ type: 'email', value: email, context: 'mailto link' }))

  // Phone regex (US and international formats)
  const phoneRegex =
    /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}(?!\d)/g
  const phones = [...new Set(text.match(phoneRegex) || [])].map((p) => p.trim())
  phones.forEach((phone) => contacts.push({ type: 'phone', value: phone }))

  // Social media links
  const socialPatterns = [
    { name: 'LinkedIn', pattern: /linkedin\.com\/in\/([a-zA-Z0-9\-]+)/g },
    { name: 'Twitter/X', pattern: /(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/g },
    { name: 'GitHub', pattern: /github\.com\/([a-zA-Z0-9\-]+)/g },
  ]

  for (const { name, pattern } of socialPatterns) {
    const matches = [...new Set(text.match(pattern) || [])]
    matches.forEach((m) => contacts.push({ type: name, value: `https://${m}` }))
  }

  // Company/person names from meta or headings (simple heuristic)
  const headingText = pageContext.mainContent.slice(0, 500)
  const namePattern = /(?:Contact|About|Team):\s*([A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/g
  let nameMatch
  while ((nameMatch = namePattern.exec(headingText)) !== null) {
    contacts.push({ type: 'name', value: nameMatch[1], context: 'heading context' })
  }

  return {
    success: true,
    data: {
      contacts,
      count: contacts.length,
      emails: contacts.filter((c) => c.type === 'email').map((c) => c.value),
      phones: contacts.filter((c) => c.type === 'phone').map((c) => c.value),
    },
  }
}
