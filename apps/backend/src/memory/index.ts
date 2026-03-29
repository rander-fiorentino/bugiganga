import type { SessionMemory, ActionRecord } from '@bugiganga/types'
import { getDb, isDbAvailable } from './db'

// ============================================================
// In-memory fallback store (used when DB is unavailable)
// ============================================================

const memoryStore = new Map<string, SessionMemory>()

// ============================================================
// Save memory
// ============================================================

export async function saveMemory(input: {
  sessionId: string
  notes?: string[]
  extractedData?: Record<string, unknown>
  actions?: ActionRecord[]
}): Promise<void> {
  const { sessionId, notes = [], extractedData = {}, actions = [] } = input

  if (await isDbAvailable()) {
    try {
      const db = getDb()
      // Upsert memory record
      await db.query(
        `INSERT INTO session_memory (session_id, notes, extracted_data, actions, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (session_id) DO UPDATE SET
           notes = session_memory.notes || $2::text[],
           extracted_data = session_memory.extracted_data || $3::jsonb,
           actions = session_memory.actions || $4::jsonb,
           updated_at = NOW()`,
        [
          sessionId,
          notes,
          JSON.stringify(extractedData),
          JSON.stringify(actions),
        ]
      )
      return
    } catch (err) {
      console.warn('[memory] DB save failed, using in-memory:', err)
    }
  }

  // In-memory fallback
  const existing = memoryStore.get(sessionId) || createEmptyMemory(sessionId)
  existing.notes = [...existing.notes, ...notes].slice(-100)
  existing.extractedData = { ...existing.extractedData, ...extractedData }
  existing.actions = [...existing.actions, ...actions].slice(-200)
  memoryStore.set(sessionId, existing)
}

// ============================================================
// Get memory
// ============================================================

export async function getMemory(sessionId: string): Promise<SessionMemory | null> {
  if (await isDbAvailable()) {
    try {
      const db = getDb()
      const result = await db.query(
        'SELECT * FROM session_memory WHERE session_id = $1',
        [sessionId]
      )
      if (result.rows.length > 0) {
        const row = result.rows[0]
        return {
          sessionId: row.session_id,
          notes: row.notes || [],
          extractedData: row.extracted_data || {},
          actions: row.actions || [],
          preferences: row.preferences || {},
        }
      }
    } catch (err) {
      console.warn('[memory] DB read failed, using in-memory:', err)
    }
  }

  return memoryStore.get(sessionId) || null
}

// ============================================================
// Clear memory
// ============================================================

export async function clearMemory(sessionId: string): Promise<void> {
  if (await isDbAvailable()) {
    try {
      const db = getDb()
      await db.query('DELETE FROM session_memory WHERE session_id = $1', [sessionId])
      return
    } catch (err) {
      console.warn('[memory] DB clear failed:', err)
    }
  }

  memoryStore.delete(sessionId)
}

// ============================================================
// Helpers
// ============================================================

function createEmptyMemory(sessionId: string): SessionMemory {
  return {
    sessionId,
    notes: [],
    extractedData: {},
    actions: [],
    preferences: {},
  }
}
