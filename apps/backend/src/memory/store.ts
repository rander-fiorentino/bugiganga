// apps/backend/src/memory/store.ts
// Memory Store with TF-IDF semantic search

import { getDb, isDbAvailable } from './db'

export type MemoryType = 'episodic' | 'semantic' | 'procedural'

export interface MemoryEntry {
  id: string
  type: MemoryType
  content: string
  metadata: Record<string, unknown>
  sessionId?: string
  createdAt: Date
  updatedAt: Date
  accessCount: number
}

interface TfIdfVector {
  [term: string]: number
}

// ── In-memory fallback ──────────────────────────────────────────
const memoryEntries = new Map<string, MemoryEntry>()

function generateId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

// ── TF-IDF helpers ──────────────────────────────────────────────
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2)
}

function termFrequency(tokens: string[]): Record<string, number> {
  const tf: Record<string, number> = {}
  for (const token of tokens) {
    tf[token] = (tf[token] ?? 0) + 1
  }
  const total = tokens.length || 1
  for (const term in tf) {
    tf[term] = tf[term] / total
  }
  return tf
}

function buildTfIdf(entries: MemoryEntry[]): TfIdfVector[] {
  const docs = entries.map(e => tokenize(e.content))
  const df: Record<string, number> = {}
  for (const doc of docs) {
    const unique = new Set(doc)
    for (const term of unique) {
      df[term] = (df[term] ?? 0) + 1
    }
  }
  const N = docs.length || 1
  return docs.map(doc => {
    const tf = termFrequency(doc)
    const tfidf: TfIdfVector = {}
    for (const term in tf) {
      const idf = Math.log(N / (df[term] ?? 1))
      tfidf[term] = tf[term] * idf
    }
    return tfidf
  })
}

function cosineSimilarity(a: TfIdfVector, b: TfIdfVector): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  let dot = 0, normA = 0, normB = 0
  for (const k of keys) {
    const va = a[k] ?? 0
    const vb = b[k] ?? 0
    dot += va * vb
    normA += va * va
    normB += vb * vb
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

// ── CRUD ────────────────────────────────────────────────────────
export async function addMemory(
  content: string,
  type: MemoryType = 'episodic',
  metadata: Record<string, unknown> = {},
  sessionId?: string
): Promise<MemoryEntry> {
  const entry: MemoryEntry = {
    id: generateId(),
    type,
    content,
    metadata,
    sessionId,
    createdAt: new Date(),
    updatedAt: new Date(),
    accessCount: 0,
  }

  if (await isDbAvailable()) {
    const db = getDb()
    await db.query(
      `INSERT INTO memory_store (id, type, content, metadata, session_id, created_at, updated_at, access_count)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), 0)`,
      [entry.id, entry.type, entry.content, JSON.stringify(entry.metadata), entry.sessionId ?? null]
    )
  } else {
    memoryEntries.set(entry.id, entry)
  }

  return entry
}

export async function getMemory(id: string): Promise<MemoryEntry | null> {
  if (await isDbAvailable()) {
    const db = getDb()
    const result = await db.query('SELECT * FROM memory_store WHERE id = $1', [id])
    if (result.rows.length === 0) return null
    const row = result.rows[0]
    await db.query('UPDATE memory_store SET access_count = access_count + 1 WHERE id = $1', [id])
    return rowToEntry(row)
  }
  const entry = memoryEntries.get(id)
  if (entry) {
    entry.accessCount++
    entry.updatedAt = new Date()
  }
  return entry ?? null
}

export async function deleteMemory(id: string): Promise<boolean> {
  if (await isDbAvailable()) {
    const db = getDb()
    const result = await db.query('DELETE FROM memory_store WHERE id = $1', [id])
    return (result.rowCount ?? 0) > 0
  }
  return memoryEntries.delete(id)
}

export async function listMemories(
  type?: MemoryType,
  sessionId?: string,
  limit = 50
): Promise<MemoryEntry[]> {
  if (await isDbAvailable()) {
    const db = getDb()
    const conditions: string[] = []
    const params: unknown[] = []
    if (type) { params.push(type); conditions.push(`type = $${params.length}`) }
    if (sessionId) { params.push(sessionId); conditions.push(`session_id = $${params.length}`) }
    params.push(limit)
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const result = await db.query(
      `SELECT * FROM memory_store ${where} ORDER BY updated_at DESC LIMIT $${params.length}`,
      params
    )
    return result.rows.map(rowToEntry)
  }
  let entries = Array.from(memoryEntries.values())
  if (type) entries = entries.filter(e => e.type === type)
  if (sessionId) entries = entries.filter(e => e.sessionId === sessionId)
  return entries.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, limit)
}

// ── Semantic search via TF-IDF ──────────────────────────────────
export async function searchMemories(
  query: string,
  limit = 10,
  type?: MemoryType
): Promise<Array<MemoryEntry & { score: number }>> {
  const all = await listMemories(type, undefined, 500)
  if (all.length === 0) return []

  const queryTokens = tokenize(query)
  const queryTf = termFrequency(queryTokens)

  const vectors = buildTfIdf(all)

  // Build query vector using same IDF
  const docs = all.map(e => tokenize(e.content))
  const df: Record<string, number> = {}
  for (const doc of docs) {
    const unique = new Set(doc)
    for (const term of unique) {
      df[term] = (df[term] ?? 0) + 1
    }
  }
  const N = docs.length || 1
  const queryVec: TfIdfVector = {}
  for (const term in queryTf) {
    const idf = Math.log(N / (df[term] ?? 1))
    queryVec[term] = queryTf[term] * idf
  }

  const scored = all.map((entry, i) => ({
    ...entry,
    score: cosineSimilarity(queryVec, vectors[i] ?? {}),
  }))

  return scored
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

// ── Consolidation ───────────────────────────────────────────────
export async function consolidateMemories(sessionId: string): Promise<string> {
  const entries = await listMemories(undefined, sessionId, 100)
  if (entries.length === 0) return 'No memories to consolidate.'

  const summary = entries
    .map(e => `[${e.type}] ${e.content}`)
    .join('\n')
    .slice(0, 2000)

  await addMemory(
    `Consolidated context (${entries.length} entries): ${summary}`,
    'semantic',
    { consolidated: true, sourceCount: entries.length },
    sessionId
  )

  return summary
}

// ── Context summary for agent ───────────────────────────────────
export async function getContextSummary(
  sessionId: string,
  maxEntries = 10
): Promise<string> {
  const entries = await listMemories(undefined, sessionId, maxEntries)
  if (entries.length === 0) return 'No previous context.'
  return entries
    .map(e => `- [${e.type}] ${e.content.slice(0, 200)}`)
    .join('\n')
}

// ── DB row mapper ───────────────────────────────────────────────
function rowToEntry(row: Record<string, unknown>): MemoryEntry {
  return {
    id: row['id'] as string,
    type: row['type'] as MemoryType,
    content: row['content'] as string,
    metadata: typeof row['metadata'] === 'string'
      ? JSON.parse(row['metadata'] as string)
      : (row['metadata'] as Record<string, unknown>) ?? {},
    sessionId: (row['session_id'] as string) ?? undefined,
    createdAt: new Date(row['created_at'] as string),
    updatedAt: new Date(row['updated_at'] as string),
    accessCount: (row['access_count'] as number) ?? 0,
  }
}
