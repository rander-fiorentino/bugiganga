import { useState, useCallback, useRef } from 'react'
import type { Message } from '@bugiganga/types'

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export interface UseChatOptions {
  sessionId: string
  pageUrl?: string
  onGetPageContext?: () => Promise<unknown>
  backendUrl?: string
}

export interface UseChatReturn {
  messages: Message[]
  isLoading: boolean
  error: string | null
  sendMessage: (content: string) => Promise<void>
  clearMessages: () => void
  addMessage: (message: Message) => void
}

export function useChat({
  sessionId,
  pageUrl,
  onGetPageContext,
  backendUrl = 'http://localhost:3000',
}: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const addMessage = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message])
  }, [])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return

      // Cancel any pending request
      abortControllerRef.current?.abort()
      abortControllerRef.current = new AbortController()

      const userMsg: Message = {
        id: generateId(),
        role: 'user',
        content: content.trim(),
        timestamp: Date.now(),
        metadata: { pageUrl },
      }

      setMessages((prev) => [...prev, userMsg])
      setIsLoading(true)
      setError(null)

      try {
        const pageContext = onGetPageContext ? await onGetPageContext() : null

        const response = await fetch(`${backendUrl}/agent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: content,
            sessionId,
            pageContext,
            conversationHistory: messages.slice(-10),
          }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`)
        }

        const data = await response.json()

        let assistantContent = ''
        if (data.status === 'completed' && data.result?.response) {
          assistantContent = data.result.response
        } else if (data.message) {
          assistantContent = data.message
        } else if (data.error) {
          assistantContent = `Error: ${data.error}`
        } else {
          assistantContent = 'I processed your request.'
        }

        const assistantMsg: Message = {
          id: generateId(),
          role: 'assistant',
          content: assistantContent,
          timestamp: Date.now(),
          metadata: {
            toolsUsed: data.result?.toolsUsed,
            isError: data.status === 'error',
          },
        }

        setMessages((prev) => [...prev, assistantMsg])
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return

        const errorMsg: Message = {
          id: generateId(),
          role: 'assistant',
          content:
            err instanceof Error
              ? err.message
              : 'Failed to connect to the backend. Please ensure the server is running.',
          timestamp: Date.now(),
          metadata: { isError: true },
        }
        setMessages((prev) => [...prev, errorMsg])
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    },
    [isLoading, messages, sessionId, pageUrl, onGetPageContext, backendUrl]
  )

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return { messages, isLoading, error, sendMessage, clearMessages, addMessage }
}
