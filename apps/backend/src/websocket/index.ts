// WebSocket support (optional real-time streaming)
// This is a placeholder for future streaming support.
// Currently the backend uses request/response over HTTP.

import type { Server } from 'http'

interface WsClient {
  sessionId: string
  send: (data: string) => void
  close: () => void
}

const clients = new Map<string, WsClient[]>()

export function getClientsForSession(sessionId: string): WsClient[] {
  return clients.get(sessionId) || []
}

export function broadcastToSession(sessionId: string, event: string, data: unknown): void {
  const sessionClients = clients.get(sessionId) || []
  const message = JSON.stringify({ event, data, timestamp: Date.now() })
  sessionClients.forEach((client) => {
    try {
      client.send(message)
    } catch (err) {
      console.warn('[ws] Failed to send to client:', err)
    }
  })
}

export function setupWebSocket(_server: Server): void {
  // Future: implement ws or socket.io for real-time plan step updates
  console.log('[ws] WebSocket setup skipped (not configured)')
}
