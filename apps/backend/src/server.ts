import 'dotenv/config'
import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import { agentLoop } from './agent/agentLoop'
import { saveMemory, getMemory } from './memory/index'
import { saveLog, getLogs } from './logs/index'
import { runTool } from './tools/executor'
import { getSession, saveSession } from './memory/sessions'
import type { AgentInput } from '@bugiganga/types'
import memoryRouter from './routes/memory'
import plannerRouter from './routes/planner'
import toolsRouter from './routes/tools'

const app = express()
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000

// ============================================================
// Middleware
// ============================================================

app.use(
  cors({
    origin: '*', // Allow Chrome extension and any origin
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id'],
  })
)
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

// Request logger
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()
})

// ============================================================
// Health check
// ============================================================
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.2.0',
  })
})

// ============================================================
// Phase 2 Routes
// ============================================================
app.use('/api/memory', memoryRouter)
app.use('/api/planner', plannerRouter)
app.use('/api/tools', toolsRouter)

// ============================================================
// Agent endpoint
// ============================================================
app.post('/agent', async (req: Request, res: Response) => {
  try {
    const input: AgentInput = req.body
    if (!input.message) {
      return res.status(400).json({ error: 'message is required' })
    }
    if (!input.sessionId) {
      return res.status(400).json({ error: 'sessionId is required' })
    }
    const output = await agentLoop(input)
    return res.json(output)
  } catch (err) {
    console.error('[/agent] Error:', err)
    return res.status(500).json({
      status: 'error',
      error: err instanceof Error ? err.message : 'Internal server error',
    })
  }
})

// ============================================================
// Memory endpoints (legacy)
// ============================================================
app.post('/memory/save', async (req: Request, res: Response) => {
  try {
    const { sessionId, notes, extractedData, actions } = req.body
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' })
    await saveMemory({ sessionId, notes, extractedData, actions })
    return res.json({ success: true })
  } catch (err) {
    console.error('[/memory/save] Error:', err)
    return res.status(500).json({ error: String(err) })
  }
})

app.get('/memory/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params
    const memory = await getMemory(sessionId)
    return res.json(memory)
  } catch (err) {
    console.error('[/memory/session] Error:', err)
    return res.status(500).json({ error: String(err) })
  }
})

// ============================================================
// Logs endpoints
// ============================================================
app.post('/logs', async (req: Request, res: Response) => {
  try {
    const { sessionId, level, message, data } = req.body
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' })
    await saveLog({ sessionId, level: level || 'info', message, data })
    return res.json({ success: true })
  } catch (err) {
    console.error('[/logs] Error:', err)
    return res.status(500).json({ error: String(err) })
  }
})

app.get('/logs/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params
    const logs = await getLogs(sessionId)
    return res.json(logs)
  } catch (err) {
    return res.status(500).json({ error: String(err) })
  }
})

// ============================================================
// Tools endpoint (legacy)
// ============================================================
app.post('/tools/run', async (req: Request, res: Response) => {
  try {
    const { tool, input } = req.body
    if (!tool) return res.status(400).json({ error: 'tool name is required' })
    const result = await runTool(tool, input || {})
    return res.json(result)
  } catch (err) {
    console.error('[/tools/run] Error:', err)
    return res.status(500).json({ success: false, error: String(err) })
  }
})

// ============================================================
// Session endpoints
// ============================================================
app.get('/session/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const session = await getSession(id)
    if (!session) return res.status(404).json({ error: 'Session not found' })
    return res.json(session)
  } catch (err) {
    return res.status(500).json({ error: String(err) })
  }
})

app.post('/session', async (req: Request, res: Response) => {
  try {
    const session = req.body
    await saveSession(session)
    return res.json({ success: true })
  } catch (err) {
    return res.status(500).json({ error: String(err) })
  }
})

// ============================================================
// Error handler
// ============================================================
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Unhandled error]', err)
  res.status(500).json({ error: 'Internal server error' })
})

// ============================================================
// Start
// ============================================================
app.listen(PORT, () => {
  console.log(`[Bugiganga Backend] Server running on http://localhost:${PORT}`)
  console.log(`[Bugiganga Backend] Anthropic API key: ${process.env.ANTHROPIC_API_KEY ? 'set' : 'NOT SET'}`)
  console.log(`[Bugiganga Backend] Routes: /api/memory, /api/planner, /api/tools`)
})

export default app
