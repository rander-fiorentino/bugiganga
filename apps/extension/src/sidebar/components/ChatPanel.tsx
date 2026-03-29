import React, { useRef, useEffect, useCallback, useState } from 'react'
import type { Message } from '@bugiganga/types'

interface ChatPanelProps {
  messages: Message[]
  isLoading: boolean
  onSendMessage: (message: string) => void
  formatTime: (timestamp: number) => string
}

export function ChatPanel({ messages, isLoading, onSendMessage, formatTime }: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [inputValue])

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim()
    if (!trimmed || isLoading) return
    onSendMessage(trimmed)
    setInputValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [inputValue, isLoading, onSendMessage])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {messages.length === 0 && !isLoading && (
          <div className="empty-state">
            <div className="empty-state__icon">🤖</div>
            <div className="empty-state__title">Bugiganga pronto</div>
            <div className="empty-state__subtitle">
              Pergunte algo sobre esta página ou use as ações rápidas acima
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} formatTime={formatTime} />
        ))}

        {isLoading && (
          <div className="message message--assistant">
            <div className="message__avatar">B</div>
            <div className="typing-indicator">
              <span className="typing-indicator__dot" />
              <span className="typing-indicator__dot" />
              <span className="typing-indicator__dot" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <div className="chat-input-wrapper">
          <textarea
            ref={textareaRef}
            className="chat-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte algo sobre esta página…"
            rows={1}
            disabled={isLoading}
            aria-label="Chat input"
          />
          <button
            className="chat-send-btn"
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            aria-label="Send message"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M13 1L1 5.5l5 1.5 1.5 5L13 1z"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

function ChatMessage({
  message,
  formatTime,
}: {
  message: Message
  formatTime: (t: number) => string
}) {
  const isUser = message.role === 'user'
  const isError = message.metadata?.isError

  return (
    <div
      className={[
        'message',
        isUser ? 'message--user' : 'message--assistant',
        isError ? 'message--error' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="message__avatar">{isUser ? 'U' : 'B'}</div>
      <div>
        <div
          className="message__bubble"
          dangerouslySetInnerHTML={{ __html: formatMessageContent(message.content) }}
        />
        <div className="message__time">{formatTime(message.timestamp)}</div>
      </div>
    </div>
  )
}

function formatMessageContent(content: string): string {
  // Basic markdown-like formatting
  return content
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:rgba(0,0,0,0.07);padding:1px 4px;border-radius:3px;font-family:monospace;font-size:12px">$1</code>')
    .replace(/\n/g, '<br/>')
}
