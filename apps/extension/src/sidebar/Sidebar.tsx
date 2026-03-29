import React, { useState, useEffect, useCallback } from 'react'
import type { Message, Plan, PageContext } from '@bugiganga/types'
import { Header } from './components/Header'
import { ChatPanel } from './components/ChatPanel'
import { QuickActions } from './components/QuickActions'
import { PlanExecutionPanel } from './components/PlanExecutionPanel'

export interface SidebarState {
  messages: Message[]
  isLoading: boolean
  currentPlan: Plan | null
  pageUrl: string
  pageTitle: string
  error: string | null
  sessionId: string
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function Sidebar() {
  const [state, setState] = useState<SidebarState>({
    messages: [],
    isLoading: false,
    currentPlan: null,
    pageUrl: '',
    pageTitle: '',
    error: null,
    sessionId: '',
  })

  // Initialize session ID and get current tab info
  useEffect(() => {
    // Get or create session ID
    chrome.storage.local.get(['bugiganga_session_id'], (result) => {
      const sessionId = result.bugiganga_session_id || generateId()
      if (!result.bugiganga_session_id) {
        chrome.storage.local.set({ bugiganga_session_id: sessionId })
      }
      setState((prev) => ({ ...prev, sessionId }))
    })

    // Get current tab info
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        setState((prev) => ({
          ...prev,
          pageUrl: tabs[0].url || '',
          pageTitle: tabs[0].title || '',
        }))
      }
    })

    // Listen for tab updates
    const handleTabUpdate = (
      _tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab
    ) => {
      if (changeInfo.status === 'complete' && tab.active) {
        setState((prev) => ({
          ...prev,
          pageUrl: tab.url || '',
          pageTitle: tab.title || '',
        }))
      }
    }

    chrome.tabs.onUpdated.addListener(handleTabUpdate)
    return () => chrome.tabs.onUpdated.removeListener(handleTabUpdate)
  }, [])

  const getPageContext = useCallback((): Promise<PageContext | null> => {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_PAGE_CONTEXT' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error getting page context:', chrome.runtime.lastError)
          resolve(null)
        } else {
          resolve(response?.pageContext || null)
        }
      })
    })
  }, [])

  const sendMessage = useCallback(
    async (userMessage: string) => {
      if (!userMessage.trim() || state.isLoading) return

      const userMsg: Message = {
        id: generateId(),
        role: 'user',
        content: userMessage.trim(),
        timestamp: Date.now(),
        metadata: { pageUrl: state.pageUrl },
      }

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMsg],
        isLoading: true,
        error: null,
        currentPlan: null,
      }))

      try {
        const pageContext = await getPageContext()

        const response = await new Promise<{
          status: string
          result?: { response: string; toolsUsed?: string[] }
          plan?: Plan
          error?: string
          message?: string
        }>((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: 'AGENT_REQUEST',
              payload: {
                message: userMessage,
                sessionId: state.sessionId,
                pageContext,
                conversationHistory: state.messages.slice(-10),
              },
            },
            (res) => {
              if (chrome.runtime.lastError) {
                resolve({ status: 'error', error: chrome.runtime.lastError.message })
              } else {
                resolve(res || { status: 'error', error: 'No response' })
              }
            }
          )
        })

        if (response.status === 'awaiting_confirmation' && response.plan) {
          setState((prev) => ({ ...prev, currentPlan: response.plan! }))
          const confirmMsg: Message = {
            id: generateId(),
            role: 'assistant',
            content: `Plano pronto: **${response.plan.description}**\n\nIsso vai executar ${response.plan.steps.length} passo(s). Posso prosseguir?`,
            timestamp: Date.now(),
            metadata: { planId: response.plan.id },
          }
          setState((prev) => ({
            ...prev,
            messages: [...prev.messages, confirmMsg],
            isLoading: false,
          }))
        } else if (response.status === 'completed' && response.result) {
          const assistantMsg: Message = {
            id: generateId(),
            role: 'assistant',
            content: response.result.response,
            timestamp: Date.now(),
            metadata: { toolsUsed: response.result.toolsUsed },
          }
          setState((prev) => ({
            ...prev,
            messages: [...prev.messages, assistantMsg],
            isLoading: false,
            currentPlan: null,
          }))
        } else {
          const errorMsg: Message = {
            id: generateId(),
            role: 'assistant',
            content: response.error || response.message || 'Algo deu errado. Tente novamente.',
            timestamp: Date.now(),
            metadata: { isError: true },
          }
          setState((prev) => ({
            ...prev,
            messages: [...prev.messages, errorMsg],
            isLoading: false,
          }))
        }
      } catch (err) {
        const errorMsg: Message = {
          id: generateId(),
          role: 'assistant',
          content: 'Não foi possível conectar ao servidor. Verifique se o backend está rodando.',
          timestamp: Date.now(),
          metadata: { isError: true },
        }
        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, errorMsg],
          isLoading: false,
        }))
      }
    },
    [state.isLoading, state.messages, state.pageUrl, state.sessionId, getPageContext]
  )

  const handleQuickAction = useCallback(
    (action: string) => {
      const quickMessages: Record<string, string> = {
        summarize: 'Summarize this page for me',
        contacts: 'Extract all contacts (emails, phones, names) from this page',
        fill_form: 'Help me fill out the form on this page',
      }
      const msg = quickMessages[action]
      if (msg) sendMessage(msg)
    },
    [sendMessage]
  )

  const handleClearChat = useCallback(() => {
    setState((prev) => ({ ...prev, messages: [], currentPlan: null, error: null }))
  }, [])

  return (
    <div className="sidebar">
      <Header
        title="Bugiganga"
        pageUrl={state.pageUrl}
        pageTitle={state.pageTitle}
        onClear={handleClearChat}
      />
      <QuickActions onAction={handleQuickAction} disabled={state.isLoading} />
      <ChatPanel
        messages={state.messages}
        isLoading={state.isLoading}
        onSendMessage={sendMessage}
        formatTime={formatTime}
      />
      {state.currentPlan && (
        <PlanExecutionPanel plan={state.currentPlan} />
      )}
    </div>
  )
}
