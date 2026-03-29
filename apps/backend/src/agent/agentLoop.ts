import type { AgentInput, AgentOutput, AgentResult, ActionRecord } from '@bugiganga/types'
import { classifyIntent } from './intentClassifier'
import { createPlan } from '../planner/createPlan'
import { runTool } from '../tools/executor'
import { saveMemory, getMemory } from '../memory/index'
import { saveLog } from '../logs/index'

// ============================================================
// Agent Loop
// ============================================================

export async function agentLoop(input: AgentInput): Promise<AgentOutput> {
  const startTime = Date.now()

  try {
    // 1. Load existing session context
    const context = await loadContext(input.sessionId)

    // 2. Classify intent
    console.log(`[agentLoop] Classifying intent for: "${input.message.slice(0, 80)}"`)
    const intent = await classifyIntent(
      input.message,
      input.conversationHistory || []
    )
    console.log(`[agentLoop] Intent: ${intent.type} (confidence: ${intent.confidence})`)

    // 3. If intent already resolved a URL (e.g. "procure X no google"), skip planning
    const intentWithUrl = intent as typeof intent & { targetUrl?: string; searchQuery?: string }
    if (intent.type === 'navigate' && intentWithUrl.targetUrl) {
      const { runTool } = await import('../tools/executor')
      const navResult = await runTool('navigateToUrl', { url: intentWithUrl.targetUrl })
      const searchDesc = intentWithUrl.searchQuery || intentWithUrl.targetUrl
      const isSearch = !!intentWithUrl.searchQuery
      const responseText = navResult.success
        ? isSearch
          ? `Pesquisando "${searchDesc}" no Google...`
          : `Abrindo ${searchDesc}...`
        : `Não consegui navegar: ${navResult.error}`
      return {
        status: 'completed',
        result: {
          response: responseText,
          actions: [{ tool: 'navigateToUrl', input: { url: intentWithUrl.targetUrl }, output: navResult, timestamp: Date.now(), success: navResult.success }],
          notes: [],
          toolsUsed: ['navigateToUrl'],
          data: {},
        },
      }
    }

    // 3. Create execution plan
    const plan = await createPlan({
      intent,
      context,
      message: input.message,
      pageContext: input.pageContext,
    })
    console.log(`[agentLoop] Plan created: ${plan.steps.length} steps, requiresConfirmation: ${plan.requiresConfirmation}`)

    // 4. Check if confirmation needed for destructive actions
    if (plan.requiresConfirmation) {
      return { status: 'awaiting_confirmation', plan }
    }

    // 5. Execute plan steps
    const actions: ActionRecord[] = []
    const notes: string[] = []
    const toolsUsed: string[] = []
    const results: unknown[] = []

    for (const step of plan.steps) {
      console.log(`[agentLoop] Executing step ${step.order}: ${step.tool}`)
      step.status = 'running'

      try {
        const toolResult = await runTool(step.tool, {
          ...step.input,
          pageContext: input.pageContext,
          sessionId: input.sessionId,
        })

        step.status = toolResult.success ? 'completed' : 'failed'
        step.result = toolResult.data

        const record: ActionRecord = {
          tool: step.tool,
          input: step.input,
          output: toolResult,
          timestamp: Date.now(),
          success: toolResult.success,
          error: toolResult.error,
        }

        actions.push(record)
        if (!toolsUsed.includes(step.tool)) toolsUsed.push(step.tool)
        if (toolResult.success && toolResult.data) results.push(toolResult.data)
        if (toolResult.error) notes.push(`Step ${step.order} failed: ${toolResult.error}`)
      } catch (err) {
        step.status = 'failed'
        step.error = String(err)
        console.error(`[agentLoop] Step ${step.order} threw:`, err)
        actions.push({
          tool: step.tool,
          input: step.input,
          output: null,
          timestamp: Date.now(),
          success: false,
          error: String(err),
        })
      }
    }

    // 6. Synthesize response
    const responseText = await synthesizeResponse(input.message, intent, results, plan, notes)

    // 7. Save memory
    try {
      await saveMemory({
        sessionId: input.sessionId,
        notes,
        actions,
        extractedData: extractDataFromResults(results),
      })
    } catch (memErr) {
      console.warn('[agentLoop] Memory save failed:', memErr)
    }

    // 8. Save log
    try {
      await saveLog({
        sessionId: input.sessionId,
        level: 'info',
        message: `Agent loop completed in ${Date.now() - startTime}ms`,
        data: {
          intent: intent.type,
          toolsUsed,
          stepCount: plan.steps.length,
          successCount: actions.filter((a) => a.success).length,
        },
      })
    } catch (logErr) {
      console.warn('[agentLoop] Log save failed:', logErr)
    }

    const result: AgentResult = {
      response: responseText,
      actions,
      notes,
      toolsUsed,
      data: extractDataFromResults(results) as Record<string, unknown>,
    }

    return { status: 'completed', result }
  } catch (err) {
    console.error('[agentLoop] Fatal error:', err)
    return {
      status: 'error',
      error: err instanceof Error ? err.message : 'Unknown error occurred',
      message: 'I encountered an error processing your request. Please try again.',
    }
  }
}

// ============================================================
// Context loading
// ============================================================

async function loadContext(sessionId: string): Promise<Record<string, unknown>> {
  try {
    const memory = await getMemory(sessionId)
    return memory ? { memory } : {}
  } catch {
    return {}
  }
}

// ============================================================
// Response synthesis
// ============================================================

async function synthesizeResponse(
  message: string,
  intent: { type: string },
  results: unknown[],
  plan: { description: string; steps: Array<{ status: string; tool: string; result?: unknown }> },
  notes: string[]
): Promise<string> {
  const completedSteps = plan.steps.filter((s) => s.status === 'completed')
  const failedSteps = plan.steps.filter((s) => s.status === 'failed')

  // If we have meaningful results, build a response from them
  if (results.length === 0 && failedSteps.length === plan.steps.length) {
    return `I tried to ${plan.description.toLowerCase()} but encountered issues. ${notes.join(' ')}`
  }

  // Build a structured response from results
  const parts: string[] = []

  for (const step of completedSteps) {
    if (!step.result) continue
    const r = step.result as Record<string, unknown>

    switch (step.tool) {
      case 'summarizePage':
        if (r.summary) parts.push(String(r.summary))
        break
      case 'extractContacts':
        if (r.contacts) {
          const contacts = r.contacts as Array<{ type: string; value: string; context?: string }>
          if (contacts.length > 0) {
            parts.push(`Found ${contacts.length} contact(s):\n${contacts.map((c) => `• ${c.type}: ${c.value}`).join('\n')}`)
          } else {
            parts.push('No contacts found on this page.')
          }
        }
        break
      case 'extractTableData':
        if (r.tables) {
          const tables = r.tables as Array<{ headers: string[]; rows: string[][] }>
          if (tables.length > 0) {
            parts.push(`Extracted ${tables.length} table(s) from the page.`)
          }
        }
        break
      case 'extractKeyEntities':
        if (r.entities) {
          parts.push(String(r.entities))
        }
        break
      case 'getVisibleText':
        if (r.text && typeof r.text === 'string') {
          parts.push(`Page content:\n${r.text.slice(0, 1000)}`)
        }
        break
      case 'getInteractiveElements':
        if (r.elements) {
          const elements = r.elements as unknown[]
          parts.push(`Found ${elements.length} interactive element(s) on the page.`)
        }
        break
      case 'clickElement':
      case 'typeIntoField':
      case 'fillFormFields':
      case 'navigateToUrl':
        // Action tools — just note completion
        parts.push(`✓ ${step.tool.replace(/([A-Z])/g, ' $1').trim()} completed.`)
        break
    }
  }

  if (failedSteps.length > 0) {
    parts.push(`Note: ${failedSteps.length} step(s) could not be completed.`)
  }

  return parts.length > 0 ? parts.join('\n\n') : `I processed your request: "${message}". ${plan.description}.`
}

// ============================================================
// Data extraction from results
// ============================================================

function extractDataFromResults(results: unknown[]): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  let i = 0
  for (const result of results) {
    if (result && typeof result === 'object') {
      const r = result as Record<string, unknown>
      if (r.summary) data.summary = r.summary
      if (r.contacts) data.contacts = r.contacts
      if (r.tables) data.tables = r.tables
      if (r.entities) data.entities = r.entities
      if (r.text) data[`text_${i}`] = r.text
    }
    i++
  }
  return data
}
