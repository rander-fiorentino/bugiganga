import type { Log } from '@bugiganga/types'
import { getDb, isDbAvailable } from '../memory/db'
import { v4 as uuidv4 } from 'uuid'

// In-memory fallback
const logStore = new Map<string, Log[]>()

// ============================================================
// Save log
// ============================================================

export async function saveLog(input: {
  sessionId: string
  level: Log['level']
  message: string
  data?: Record<string, unknown>
}): Promise<void> {
  const { sessionId, level, message, data } = input

  const log: Log = {
    id: uuidv4(),
    sessionId,
    level,
    message,
    data: data || {},
    timestamp: Date.now(),
  }

  if (await isDbAvailable()) {
    try {
      const db = getDb()
      await db.query(
        `INSERT INTO logs (id, session_id, level, message, data, created_at)
         VALUES ($1, $2, $3, $4, $5, to_timestamp($6 / 1000.0))`,
        [log.id, log.sessionId, log.level, log.message, JSON.stringify(log.data), log.timestamp]
      )
      return
    } catch (err) {
      console.warn('[logs] DB save failed, using in-memory:', err)
    }
  }

  // In-memory fallback
  const existing = logStore.get(sessionId) || []
  existing.push(log)
  // Keep last 500 logs per session
  if (existing.length > 500) existing.splice(0, existing.length - 500)
  logStore.set(sessionId, existing)
}

// ============================================================
// Get logs
// ============================================================

export async function getLogs(
  sessionId: string,
  options: { limit?: number; level?: Log['level'] } = {}
): Promise<Log[]> {
  const { limit = 100, level } = options

  if (await isDbAvailable()) {
    try {
      const db = getDb()
      const query = level
        ? `SELECT * FROM logs WHERE session_id = $1 AND level = $2 ORDER BY created_at DESC LIMIT $3`
        : `SELECT * FROM logs WHERE session_id = $1 ORDER BY created_at DESC LIMIT $2`

      const params = level ? [sessionId, level, limit] : [sessionId, limit]
      const result = await db.query(query, params)

      return result.rows.map((row) => ({
        id: row.id,
        sessionId: row.session_id,
        level: row.level,
        message: row.message,
        data: row.data || {},
        timestamp: new Date(row.created_at).getTime(),
      }))
    } catch (err) {
      console.warn('[logs] DB read failed, using in-memory:', err)
    }
  }

  // In-memory fallback
  let logs = logStore.get(sessionId) || []
  if (level) logs = logs.filter((l) => l.level === level)
  return logs.slice(-limit).reverse()
}

// ============================================================
// Clear logs
// ============================================================

export async function clearLogs(sessionId: string): Promise<void> {
  if (await isDbAvailable()) {
    try {
      const db = getDb()
      await db.query('DELETE FROM logs WHERE session_id = $1', [sessionId])
      return
    } catch (err) {
      console.warn('[logs] DB clear failed:', err)
    }
  }
  logStore.delete(sessionId)
}

// ============================================================
// saveLogs (convenience wrapper for agent loop)
// ============================================================

export async function saveLogs(input: {
  sessionId: string
  result: Record<string, unknown>
}): Promise<void> {
  await saveLog({
    sessionId: input.sessionId,
    level: 'info',
    message: 'Agent loop result',
    data: input.result as Record<string, unknown>,
  })
}
