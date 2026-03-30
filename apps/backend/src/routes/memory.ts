// apps/backend/src/routes/memory.ts
// REST API routes for Memory Store

import { Router, Request, Response } from 'express'
import {
  addMemory,
  getMemory,
  deleteMemory,
  listMemories,
  searchMemories,
  consolidateMemories,
  type MemoryType,
} from '../memory/store'

const router = Router()

// GET /api/memory?type=episodic&sessionId=xxx&limit=20
router.get('/', async (req: Request, res: Response) => {
  try {
    const type = req.query['type'] as MemoryType | undefined
    const sessionId = req.query['sessionId'] as string | undefined
    const limit = parseInt((req.query['limit'] as string) ?? '50', 10)
    const entries = await listMemories(type, sessionId, limit)
    res.json({ entries, count: entries.length })
  } catch (err) {
    res.status(500).json({ error: 'Failed to list memories', details: String(err) })
  }
})

// GET /api/memory/search?q=query&limit=10&type=semantic
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = req.query['q'] as string
    if (!query) return res.status(400).json({ error: 'Query parameter q is required' })
    const limit = parseInt((req.query['limit'] as string) ?? '10', 10)
    const type = req.query['type'] as MemoryType | undefined
    const results = await searchMemories(query, limit, type)
    res.json({ results, count: results.length })
  } catch (err) {
    res.status(500).json({ error: 'Search failed', details: String(err) })
  }
})

// GET /api/memory/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const entry = await getMemory(req.params['id'] ?? '')
    if (!entry) return res.status(404).json({ error: 'Memory not found' })
    res.json(entry)
  } catch (err) {
    res.status(500).json({ error: 'Failed to get memory', details: String(err) })
  }
})

// POST /api/memory
router.post('/', async (req: Request, res: Response) => {
  try {
    const { content, type, metadata, sessionId } = req.body as {
      content: string
      type?: MemoryType
      metadata?: Record<string, unknown>
      sessionId?: string
    }
    if (!content) return res.status(400).json({ error: 'content is required' })
    const entry = await addMemory(content, type ?? 'episodic', metadata ?? {}, sessionId)
    res.status(201).json(entry)
  } catch (err) {
    res.status(500).json({ error: 'Failed to add memory', details: String(err) })
  }
})

// POST /api/memory/consolidate
router.post('/consolidate', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body as { sessionId: string }
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' })
    const summary = await consolidateMemories(sessionId)
    res.json({ success: true, summary })
  } catch (err) {
    res.status(500).json({ error: 'Consolidation failed', details: String(err) })
  }
})

// DELETE /api/memory/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await deleteMemory(req.params['id'] ?? '')
    if (!deleted) return res.status(404).json({ error: 'Memory not found' })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete memory', details: String(err) })
  }
})

export default router
