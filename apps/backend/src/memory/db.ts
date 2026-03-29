import { Pool } from 'pg'

let pool: Pool | null = null
let dbAvailable: boolean | null = null

// ============================================================
// DB connection
// ============================================================

export function getDb(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/bugiganga',
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000,
    })

    pool.on('error', (err) => {
      console.warn('[db] Pool error:', err.message)
      dbAvailable = false
    })
  }

  return pool
}

export async function isDbAvailable(): Promise<boolean> {
  if (dbAvailable === false) return false
  if (!process.env.DATABASE_URL && process.env.NODE_ENV === 'development') {
    // Skip DB check in dev if no DATABASE_URL set
    if (!process.env.DATABASE_URL) {
      dbAvailable = false
      return false
    }
  }

  try {
    const db = getDb()
    await db.query('SELECT 1')
    dbAvailable = true
    return true
  } catch {
    dbAvailable = false
    return false
  }
}

// ============================================================
// Schema initialization
// ============================================================

export async function initDb(): Promise<void> {
  if (!(await isDbAvailable())) {
    console.log('[db] Database not available, using in-memory storage')
    return
  }

  try {
    const db = getDb()

    await db.query(`
      CREATE TABLE IF NOT EXISTS session_memory (
        session_id TEXT PRIMARY KEY,
        notes TEXT[] DEFAULT '{}',
        extracted_data JSONB DEFAULT '{}',
        actions JSONB DEFAULT '[]',
        preferences JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    await db.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        page_url TEXT,
        conversation_history JSONB DEFAULT '[]',
        memory JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    await db.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        level TEXT NOT NULL DEFAULT 'info',
        message TEXT NOT NULL,
        data JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    await db.query(`
      CREATE INDEX IF NOT EXISTS logs_session_id_idx ON logs(session_id);
      CREATE INDEX IF NOT EXISTS logs_created_at_idx ON logs(created_at DESC);
    `)

    console.log('[db] Schema initialized')
  } catch (err) {
    console.error('[db] Schema init failed:', err)
  }
}
