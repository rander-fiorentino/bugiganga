import Anthropic from '@anthropic-ai/sdk'
import type { PageContext, ToolResult, TableElement } from '@bugiganga/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ============================================================
// extractTableData
// ============================================================

export async function extractTableData(input: {
  pageContext?: PageContext
  tableIndex?: number
}): Promise<ToolResult> {
  const { pageContext, tableIndex } = input

  if (!pageContext) {
    return { success: false, error: 'No page context provided' }
  }

  const tables = pageContext.tables || []

  if (tables.length === 0) {
    return {
      success: true,
      data: { tables: [], count: 0, message: 'No tables found on this page' },
    }
  }

  const targetTables: TableElement[] =
    tableIndex !== undefined ? [tables[tableIndex]].filter(Boolean) : tables

  // Convert to a clean format
  const formatted = targetTables.map((table, i) => ({
    index: i,
    caption: table.caption,
    headers: table.headers,
    rows: table.rows,
    rowCount: table.rows.length,
    columnCount: table.headers.length || (table.rows[0]?.length ?? 0),
    selector: table.selector,
  }))

  return {
    success: true,
    data: {
      tables: formatted,
      count: formatted.length,
      message: `Found ${formatted.length} table(s)`,
    },
  }
}

// ============================================================
// extractKeyEntities
// ============================================================

export async function extractKeyEntities(input: {
  pageContext?: PageContext
  entityTypes?: string[]
}): Promise<ToolResult> {
  const { pageContext, entityTypes = ['person', 'organization', 'location', 'date', 'product'] } = input

  if (!pageContext?.mainContent) {
    return { success: false, error: 'No page content available for entity extraction' }
  }

  const content = pageContext.mainContent.slice(0, 3000)

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: `Extract named entities from web page content. Return a JSON object with these keys: ${entityTypes.join(', ')}.
Each key should have an array of strings. Only include entities clearly mentioned in the text.`,
      messages: [
        {
          role: 'user',
          content: `Extract entities from:\n\n${content}\n\nRespond with JSON only.`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const entities = jsonMatch ? JSON.parse(jsonMatch[0]) : {}

    return {
      success: true,
      data: {
        entities,
        entityTypes: Object.keys(entities),
        message: `Extracted entities: ${Object.keys(entities).join(', ')}`,
      },
    }
  } catch (err) {
    // Fallback: simple regex-based extraction
    const entities = fallbackEntityExtraction(content)
    return {
      success: true,
      data: {
        entities,
        message: 'Entity extraction used fallback method',
        note: 'AI extraction unavailable',
      },
    }
  }
}

// ============================================================
// extractPageSummary (alias with different prompt)
// ============================================================

export async function extractPageSummary(input: {
  pageContext?: PageContext
  format?: 'bullets' | 'paragraph'
}): Promise<ToolResult> {
  const { pageContext, format = 'paragraph' } = input

  if (!pageContext?.mainContent) {
    return { success: false, error: 'No page content available' }
  }

  const content = pageContext.mainContent.slice(0, 4000)
  const title = pageContext.title || 'Page'

  try {
    const systemPrompt =
      format === 'bullets'
        ? 'Summarize the web page as 3-5 bullet points. Be concise and informative.'
        : 'Provide a 2-3 paragraph summary of the web page. Focus on key information.'

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Title: ${title}\n\nContent:\n${content}`,
        },
      ],
    })

    const summary = response.content[0].type === 'text' ? response.content[0].text : ''
    return {
      success: true,
      data: { summary, title, url: pageContext.url, format },
    }
  } catch (err) {
    const fallback = content.slice(0, 400) + '...'
    return {
      success: true,
      data: {
        summary: fallback,
        title,
        url: pageContext.url,
        note: 'AI summary unavailable, showing raw content',
      },
    }
  }
}

// ============================================================
// Helpers
// ============================================================

function fallbackEntityExtraction(text: string): Record<string, string[]> {
  const entities: Record<string, string[]> = {
    date: [],
    email: [],
    phone: [],
  }

  // Dates
  const datePattern = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/gi
  entities.date = [...new Set(text.match(datePattern) || [])]

  // Emails
  entities.email = [
    ...new Set(text.match(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g) || []),
  ]

  // Phones
  entities.phone = [
    ...new Set(
      text.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}(?!\d)/g) || []
    ),
  ]

  return entities
}
