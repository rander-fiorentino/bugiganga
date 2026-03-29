// Background service worker
// Routes messages between sidebar <-> content script <-> backend

import type { PageContext } from '@bugiganga/types'

const BACKEND_URL = 'http://localhost:3000'

// ============================================================
// Session management
// ============================================================

async function getOrCreateSessionId(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['bugiganga_session_id'], (result) => {
      if (result.bugiganga_session_id) {
        resolve(result.bugiganga_session_id)
      } else {
        const id = generateUUID()
        chrome.storage.local.set({ bugiganga_session_id: id })
        resolve(id)
      }
    })
  })
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// ============================================================
// Tab helpers
// ============================================================

async function getActiveTabId(): Promise<number | null> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0]?.id ?? null)
    })
  })
}

async function getPageContext(tabId: number): Promise<PageContext | null> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: 'GET_PAGE_CONTEXT' }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[Bugiganga BG] Could not get page context:', chrome.runtime.lastError.message)
        resolve(null)
      } else {
        resolve(response?.pageContext ?? null)
      }
    })
  })
}

// ============================================================
// Backend communication
// ============================================================

async function callBackend(
  endpoint: string,
  body: Record<string, unknown>
): Promise<unknown> {
  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Backend error ${response.status}: ${text}`)
  }

  return response.json()
}

// ============================================================
// Action execution (forwarded to content script)
// ============================================================

async function executeAction(
  tabId: number,
  action: { type: string; selector?: string; value?: string; url?: string; fields?: unknown[] }
): Promise<unknown> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: 'EXECUTE_ACTION', payload: { action } }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message })
      } else {
        resolve(response)
      }
    })
  })
}

// ============================================================
// Main message handler
// ============================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message

  const handle = async () => {
    switch (type) {
      case 'GET_PAGE_CONTEXT': {
        const tabId = await getActiveTabId()
        if (!tabId) return { success: false, error: 'No active tab' }
        const ctx = await getPageContext(tabId)
        return { success: true, pageContext: ctx }
      }

      case 'AGENT_REQUEST': {
        try {
          const sessionId = await getOrCreateSessionId()
          const tabId = await getActiveTabId()

          // Get fresh page context if not provided
          let pageContext = payload?.pageContext
          if (!pageContext && tabId) {
            pageContext = await getPageContext(tabId)
          }

          const result = await callBackend('/agent', {
            message: payload?.message,
            sessionId,
            pageContext,
            conversationHistory: payload?.conversationHistory || [],
          })

          // If result contains an action instruction, execute it
          const agentResult = result as {
            status: string
            result?: {
              response: string
              toolsUsed?: string[]
              actions?: Array<{
                output?: { actionInstruction?: unknown }
              }>
            }
          }

          if (
            agentResult.status === 'completed' &&
            agentResult.result?.actions &&
            tabId
          ) {
            for (const action of agentResult.result.actions) {
              if (action.output && typeof action.output === 'object') {
                const output = action.output as { actionInstruction?: Record<string, unknown> }
                if (output.actionInstruction) {
                  await executeAction(tabId, output.actionInstruction as { type: string })
                }
              }
            }
          }

          return result
        } catch (err) {
          console.error('[Bugiganga BG] Agent request failed:', err)
          return {
            status: 'error',
            error: err instanceof Error ? err.message : 'Unknown error',
          }
        }
      }

      case 'EXECUTE_CONTENT_ACTION': {
        const tabId = await getActiveTabId()
        if (!tabId) return { success: false, error: 'No active tab' }
        return executeAction(tabId, payload?.action)
      }

      case 'SAVE_MEMORY': {
        try {
          return await callBackend('/memory/save', payload)
        } catch (err) {
          return { success: false, error: String(err) }
        }
      }

      case 'GET_SESSION': {
        try {
          const sessionId = await getOrCreateSessionId()
          const response = await fetch(`${BACKEND_URL}/session/${sessionId}`)
          return response.ok ? response.json() : { error: 'Session not found' }
        } catch (err) {
          return { error: String(err) }
        }
      }

      case 'CONTENT_SCRIPT_READY': {
        // Content script notified us it loaded — nothing to do here
        return { received: true }
      }

      default:
        return { error: `Unknown message type: ${type}` }
    }
  }

  handle().then(sendResponse).catch((err) => {
    sendResponse({ status: 'error', error: String(err) })
  })

  // Return true to keep the channel open for async response
  return true
})

// ============================================================
// Extension action click — open the side panel
// ============================================================

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    try {
      // @ts-ignore — sidePanel is available in MV3 with the sidePanel permission
      await chrome.sidePanel.open({ tabId: tab.id })
    } catch (err) {
      console.warn('[Bugiganga BG] Could not open side panel:', err)
    }
  }
})

// ============================================================
// Install / update handler
// ============================================================

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    const sessionId = generateUUID()
    await chrome.storage.local.set({ bugiganga_session_id: sessionId })
    console.log('[Bugiganga] Extension installed. Session:', sessionId)
  }

  // Re-inject content script em todas as abas abertas após install/update
  const tabs = await chrome.tabs.query({})
  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) continue
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      })
    } catch {
      // Ignora abas que não aceitam injeção (ex: chrome web store)
    }
  }
  console.log('[Bugiganga] Content script re-injetado em abas abertas')
})

console.log('[Bugiganga] Background service worker started')
