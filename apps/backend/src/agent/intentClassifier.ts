import Anthropic from '@anthropic-ai/sdk'
import type { Intent, IntentType, Message } from '@bugiganga/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const INTENT_DESCRIPTIONS: Record<IntentType, string> = {
  summarize_page: 'User wants a summary of the current page content',
  extract_contacts: 'User wants to extract emails, phones, names, or contact info',
  fill_form: 'User wants to fill out a form on the page',
  click_element: 'User wants to click a specific button, link, or element',
  navigate: 'User wants to navigate to a URL or open a link',
  extract_data: 'User wants to extract specific data like tables, prices, or structured info',
  answer_question: 'User is asking a question about the page content',
  search_page: 'User wants to search for something specific on the page',
  take_screenshot: 'User wants a screenshot',
  multi_step_task: 'User is requesting a complex task involving multiple steps or actions',
  unknown: 'Intent cannot be determined from the message',
}

const SYSTEM_PROMPT = `You are an intent classifier for a browser AI assistant called Bugiganga.
The user may write in Portuguese or English.

Your job is to classify the user's intent into one of these categories:
${Object.entries(INTENT_DESCRIPTIONS)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join('\n')}

Portuguese examples:
- "procure X no google" / "pesquise X" / "busque X" → navigate (search Google for X)
- "resuma a página" / "me explica essa página" → summarize_page
- "encontre contatos" / "tem algum email aqui?" → extract_contacts
- "preencha o formulário" / "preencha os campos" → fill_form
- "clique em X" / "aperte o botão X" → click_element
- "vá para X" / "abra X" / "navegue para X" → navigate
- "o que é X?" / "me fale sobre" → answer_question

Respond with ONLY a JSON object in this exact format:
{
  "type": "<intent_type>",
  "confidence": <0.0-1.0>,
  "details": "<brief explanation in English>",
  "requiredTools": ["<tool1>", "<tool2>"],
  "searchQuery": "<extracted search query if intent is navigate and user wants to search>",
  "targetUrl": "<full URL if navigate intent and you can determine it>"
}

Available tools: summarizePage, extractContacts, fillFormFields, clickElement, navigateToUrl, extractTableData, extractKeyEntities, getInteractiveElements, getVisibleText`

export async function classifyIntent(
  message: string,
  conversationHistory: Message[] = []
): Promise<Intent> {
  try {
    // Build conversation context (last 3 exchanges)
    const recentHistory = conversationHistory.slice(-6)
    const historyText = recentHistory
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n')

    const userContent = historyText
      ? `Previous conversation:\n${historyText}\n\nCurrent message: ${message}`
      : message

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return fallbackIntent(message)
    }

    const parsed = JSON.parse(jsonMatch[0])
    return {
      type: (parsed.type as IntentType) || 'unknown',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
      details: parsed.details || '',
      requiredTools: Array.isArray(parsed.requiredTools) ? parsed.requiredTools : [],
      searchQuery: parsed.searchQuery || undefined,
      targetUrl: parsed.targetUrl || undefined,
    }
  } catch (err) {
    console.error('[intentClassifier] Error:', err)
    return fallbackIntent(message)
  }
}

function fallbackIntent(message: string): Intent {
  const lower = message.toLowerCase()

  // Portuguese + English: open a site ("abra a lovable", "abra o youtube")
  if (/^abr[ae]\s+(?:a\s+|o\s+|os\s+|as\s+)?(.+)/i.test(lower)) {
    const siteMatch = lower.match(/^abr[ae]\s+(?:a\s+|o\s+|os\s+|as\s+)?(.+)/i)
    const siteName = siteMatch ? siteMatch[1].trim().replace(/\s+/g, '') : undefined
    const targetUrl = siteName ? `https://www.${siteName}.com` : undefined
    return { type: 'navigate', confidence: 0.9, details: `Open site: ${siteName}`, targetUrl }
  }
  // Portuguese + English: search/navigate
  if (/procure|pesquise|busque|search for|google for|look up/i.test(lower)) {
    const queryMatch = lower.match(/(?:procure|pesquise|busque|search for|google for|look up)\s+(.+?)(?:\s+no\s+google|\s+on\s+google)?$/i)
    const searchQuery = queryMatch ? queryMatch[1].trim() : undefined
    const targetUrl = searchQuery ? `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}` : undefined
    return { type: 'navigate', confidence: 0.9, details: `Search Google for: ${searchQuery}`, searchQuery, targetUrl }
  }
  if (/summar|overview|tldr|brief|resuma|resumo|explica|explique|me fale/i.test(lower)) {
    return { type: 'summarize_page', confidence: 0.8, details: 'Keyword match: summarize' }
  }
  if (/contact|email|phone|address|contato|telefone|endereço/i.test(lower)) {
    return { type: 'extract_contacts', confidence: 0.8, details: 'Keyword match: contacts' }
  }
  if (/fill|form|input|enter.*field|preencha|preenche|formulário/i.test(lower)) {
    return { type: 'fill_form', confidence: 0.75, details: 'Keyword match: form filling' }
  }
  if (/click|press|tap|button|clique|aperte|botão/i.test(lower)) {
    return { type: 'click_element', confidence: 0.75, details: 'Keyword match: click' }
  }
  if (/go to|navigate|open.*page|visit|navegue|vá para|abra|ir para/i.test(lower)) {
    return { type: 'navigate', confidence: 0.75, details: 'Keyword match: navigate' }
  }
  if (/extract|get|find|scrape|table|data|extraia|encontre|tabela/i.test(lower)) {
    return { type: 'extract_data', confidence: 0.7, details: 'Keyword match: extract data' }
  }
  if (/what|how|why|when|where|who|tell me|o que|como|por que|quando|onde|quem|me diz/i.test(lower)) {
    return { type: 'answer_question', confidence: 0.7, details: 'Keyword match: question' }
  }

  return { type: 'unknown', confidence: 0.3, details: 'Could not determine intent' }
}
