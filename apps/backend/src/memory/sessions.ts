import type { Session } from '@bugiganga/types'
import { getDb, isDbAvailable } from './db'

// In-memory fallback
const sessionStore = new Map<string, Session>()

export async function getSession(id: string): Promise<Session | null> {
  if (await isDbAvailable()) {
    try {
      const db = getDb()
      const result = await db.query('SELECT * FROM sessions WHERE id = $1', [id])
      if (result.rows.length > 0) {
        const row = result.rows[0]
        return {
          id: row.id,
          createdAt: new Date(row.created_at).getTime(),
          updatedAt: new Date(row.updated_at).getTime(),
          pageUrl: row.page_url,
          conversationHistory: row.conversation_history || [],
          memory: row.memory || createEmptyMemory(id),
        }
      }
    } catch (err) {
      console.warn('[sessions] DB read failed:', err)
    }
  }

  return sessionStore.get(id) || null
}

export async function saveSession(session: Session): Promise<void> {
  if (await isDbAvailable()) {
    try {
      const db = getDb()
      await db.query(
        `INSERT INTO sessions (id, page_url, conversation_history, memory, created_at, updated_at)
         VALUES ($1, $2, $3, $4, to_timestamp($5 / 1000.0), to_timestamp($6 / 1000.0))
         ON CONFLICT (id) DO UPDATE SET
           page_url = EXCLUDED.page_url,
           conversation_history = EXCLUDED.conversation_history,
           memory = EXCLUDED.memory,
           updated_at = EXCLUDED.updated_at`,
        [
          session.id,
          session.pageUrl,
          JSON.stringify(session.conversationHistory),
          JSON.stringify(session.memory),
          session.createdAt,
          Date.now(),
        ]
      )
      return
    } catch (err) {
      console.warn('[sessions] DB save failed:', err)
    }
  }

  sessionStore.set(session.id, { ...session, updatedAt: Date.now() })
}

export async function deleteSession(id: string): Promise<void> {
  if (await isDbAvailable()) {
    try {
      const db = getDb()
      await db.query('DELETE FROM sessions WHERE id = $1', [id])
      return
    } catch (err) {
      console.warn('[sessions] DB delete failed:', err)
    }
  }
  sessionStore.delete(id)
}

function createEmptyMemory(sessionId: string) {
  return {
    sessionId,
    notes: [] as string[],
    extractedData: {} as Record<string, unknown>,
    actions: [] as unknown[],
    preferences: {} as Record<string, unknown>,
  }
}
