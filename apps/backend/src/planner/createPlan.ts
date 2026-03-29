import Anthropic from '@anthropic-ai/sdk'
import type { Plan, PlanStep, Intent, PageContext } from '@bugiganga/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface CreatePlanInput {
  intent: Intent
  context: Record<string, unknown>
  message: string
  pageContext?: PageContext | null
}

// ============================================================
// Tool -> description mapping for the planner
// ============================================================

const TOOL_DESCRIPTIONS = `
Available tools:
- summarizePage: Summarizes the page content using AI
- getVisibleText: Returns the main visible text of the page
- getInteractiveElements: Returns all inputs, buttons, links
- extractContacts: Extracts emails, phones, and names from the page
- extractTableData: Extracts table data from the page
- extractKeyEntities: Extracts key entities (people, places, orgs) using AI
- extractPageSummary: Alias for summarizePage
- clickElement: Clicks a DOM element (requires selector)
- typeIntoField: Types text into an input (requires selector, text)
- fillFormFields: Fills multiple form fields (requires fields array)
- navigateToUrl: Navigates to a URL (requires url)
`

const SYSTEM_PROMPT = `You are a planning engine for a browser AI assistant. Given the user's intent and page context, create a minimal execution plan.
The user may write in Portuguese or English.

${TOOL_DESCRIPTIONS}

Respond with ONLY a JSON object:
{
  "description": "<one sentence plan description>",
  "steps": [
    {
      "order": 1,
      "tool": "<tool_name>",
      "description": "<what this step does>",
      "input": {}
    }
  ],
  "requiresConfirmation": false
}

Rules:
- Use the minimum number of steps needed
- requiresConfirmation should be true only for fill_form or click_element intents (NOT for navigate/search)
- For navigate intent with a search query (e.g. "procure carro no google"), use navigateToUrl with the Google search URL
- For fill_form intent, include actual field selectors from the page context if available
- Keep input objects simple — they will be merged with page context automatically
- For summarize intent, just use summarizePage
- For extract_contacts, just use extractContacts`

// ============================================================
// Intent -> default plan mapping (used when API call fails)
// ============================================================

function getDefaultPlan(intent: Intent, pageContext?: PageContext | null): Omit<Plan, 'id' | 'createdAt'> {
  const makeStep = (
    tool: string,
    description: string,
    input: Record<string, unknown> = {}
  ): Omit<PlanStep, 'id'> => ({
    order: 1,
    tool,
    description,
    input,
    status: 'pending',
  })

  const planMap: Record<string, { description: string; steps: Omit<PlanStep, 'id'>[]; requiresConfirmation: boolean }> = {
    summarize_page: {
      description: 'Summarize the current page content',
      steps: [{ ...makeStep('summarizePage', 'Summarize page content'), order: 1 }],
      requiresConfirmation: false,
    },
    extract_contacts: {
      description: 'Extract contact information from the page',
      steps: [{ ...makeStep('extractContacts', 'Extract emails, phones, and contacts'), order: 1 }],
      requiresConfirmation: false,
    },
    fill_form: {
      description: 'Fill in the form fields on this page',
      steps: [
        { ...makeStep('getInteractiveElements', 'Get form fields'), order: 1 },
        { ...makeStep('fillFormFields', 'Fill form fields', { fields: [] }), order: 2 },
      ],
      requiresConfirmation: true,
    },
    click_element: {
      description: 'Click the target element',
      steps: [
        { ...makeStep('getInteractiveElements', 'Find interactive elements'), order: 1 },
        { ...makeStep('clickElement', 'Click target element', { selector: '' }), order: 2 },
      ],
      requiresConfirmation: true,
    },
    navigate: {
      description: 'Navigate to the target page',
      steps: [{ ...makeStep('navigateToUrl', 'Navigate to URL', { url: '' }), order: 1 }],
      requiresConfirmation: false,
    },
    extract_data: {
      description: 'Extract structured data from the page',
      steps: [
        { ...makeStep('extractTableData', 'Extract tables'), order: 1 },
        { ...makeStep('extractKeyEntities', 'Extract key entities'), order: 2 },
      ],
      requiresConfirmation: false,
    },
    answer_question: {
      description: 'Answer the question using page content',
      steps: [{ ...makeStep('summarizePage', 'Get page content and answer question'), order: 1 }],
      requiresConfirmation: false,
    },
    search_page: {
      description: 'Search the page for the requested content',
      steps: [{ ...makeStep('getVisibleText', 'Get page text for search'), order: 1 }],
      requiresConfirmation: false,
    },
    take_screenshot: {
      description: 'Take a screenshot of the page',
      steps: [{ ...makeStep('getVisibleText', 'Get page overview'), order: 1 }],
      requiresConfirmation: false,
    },
    multi_step_task: {
      description: 'Execute multi-step task',
      steps: [
        { ...makeStep('summarizePage', 'Understand the page'), order: 1 },
        { ...makeStep('getInteractiveElements', 'Find interactive elements'), order: 2 },
      ],
      requiresConfirmation: true,
    },
    unknown: {
      description: 'Process the request',
      steps: [{ ...makeStep('summarizePage', 'Analyze page content'), order: 1 }],
      requiresConfirmation: false,
    },
  }

  const template = planMap[intent.type] || planMap.unknown

  return {
    intent,
    description: template.description,
    steps: template.steps.map((s) => ({ ...s, id: generateId() })),
    requiresConfirmation: template.requiresConfirmation,
    estimatedSteps: template.steps.length,
  }
}

// ============================================================
// Main plan creation
// ============================================================

export async function createPlan(input: CreatePlanInput): Promise<Plan> {
  const id = generateId()
  const createdAt = Date.now()

  try {
    // Build context summary for the planner
    const contextSummary = buildContextSummary(input.pageContext)

    const intentExtra = [
      input.intent.details ? `Intent details: ${input.intent.details}` : '',
      (input.intent as { searchQuery?: string }).searchQuery ? `Search query: ${(input.intent as { searchQuery?: string }).searchQuery}` : '',
      (input.intent as { targetUrl?: string }).targetUrl ? `Target URL: ${(input.intent as { targetUrl?: string }).targetUrl}` : '',
    ].filter(Boolean).join('\n')

    const userPrompt = `User intent: ${input.intent.type} (confidence: ${input.intent.confidence})
User message: "${input.message}"
${intentExtra}
${contextSummary}

Create a minimal plan to fulfill this request.`

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      const defaultPlan = getDefaultPlan(input.intent, input.pageContext)
      return { id, createdAt, ...defaultPlan }
    }

    const parsed = JSON.parse(jsonMatch[0])
    const steps: PlanStep[] = (parsed.steps || []).map(
      (s: { order: number; tool: string; description: string; input?: Record<string, unknown> }, idx: number) => ({
        id: generateId(),
        order: s.order ?? idx + 1,
        tool: s.tool,
        description: s.description,
        input: s.input || {},
        status: 'pending' as const,
      })
    )

    return {
      id,
      createdAt,
      intent: input.intent,
      description: parsed.description || `Execute ${input.intent.type}`,
      steps,
      requiresConfirmation: parsed.requiresConfirmation ?? false,
      estimatedSteps: steps.length,
    }
  } catch (err) {
    console.error('[createPlan] Error, using default plan:', err)
    const defaultPlan = getDefaultPlan(input.intent, input.pageContext)
    return { id, createdAt, ...defaultPlan }
  }
}

// ============================================================
// Helpers
// ============================================================

function buildContextSummary(pageContext?: PageContext | null): string {
  if (!pageContext) return ''

  const parts: string[] = []
  parts.push(`Page: ${pageContext.title} (${pageContext.url})`)

  if (pageContext.forms.length > 0) {
    const formFields = pageContext.forms.flatMap((f) => f.fields)
    parts.push(`Forms: ${pageContext.forms.length} form(s) with fields: ${formFields.map((f) => f.label || f.name || f.type).join(', ')}`)
  }

  if (pageContext.interactiveElements.length > 0) {
    const buttons = pageContext.interactiveElements.filter((e) => e.type === 'button').slice(0, 5)
    if (buttons.length > 0) {
      parts.push(`Buttons: ${buttons.map((b) => b.text || b.label || 'unnamed').join(', ')}`)
    }
  }

  if (pageContext.tables.length > 0) {
    parts.push(`Tables: ${pageContext.tables.length} table(s) found`)
  }

  return parts.join('\n')
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
