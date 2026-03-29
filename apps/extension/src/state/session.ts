// Session state management for the extension

import type { Session, SessionMemory, Message } from '@bugiganga/types'

const SESSION_KEY = 'bugiganga_session_id'
const SESSION_DATA_KEY = 'bugiganga_session_data'

// ============================================================
// Session ID
// ============================================================

export async function getSessionId(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.local.get([SESSION_KEY], (result) => {
      resolve(result[SESSION_KEY] || '')
    })
  })
}

export async function setSessionId(id: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [SESSION_KEY]: id }, resolve)
  })
}

export async function getOrCreateSessionId(): Promise<string> {
  const existing = await getSessionId()
  if (existing) return existing

  const newId = generateUUID()
  await setSessionId(newId)
  return newId
}

export async function resetSession(): Promise<string> {
  const newId = generateUUID()
  await chrome.storage.local.set({
    [SESSION_KEY]: newId,
    [SESSION_DATA_KEY]: createEmptySession(newId),
  })
  return newId
}

// ============================================================
// Session data
// ============================================================

export async function getSessionData(): Promise<Session | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get([SESSION_DATA_KEY], (result) => {
      resolve(result[SESSION_DATA_KEY] || null)
    })
  })
}

export async function saveSessionData(session: Session): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [SESSION_DATA_KEY]: session }, resolve)
  })
}

export async function addMessageToSession(message: Message): Promise<void> {
  const sessionId = await getSessionId()
  const sessionData = (await getSessionData()) || createEmptySession(sessionId)

  sessionData.conversationHistory.push(message)
  sessionData.updatedAt = Date.now()

  // Keep only last 50 messages to avoid storage limits
  if (sessionData.conversationHistory.length > 50) {
    sessionData.conversationHistory = sessionData.conversationHistory.slice(-50)
  }

  await saveSessionData(sessionData)
}

export async function updateSessionMemory(
  updates: Partial<SessionMemory>
): Promise<void> {
  const sessionId = await getSessionId()
  const sessionData = (await getSessionData()) || createEmptySession(sessionId)

  sessionData.memory = { ...sessionData.memory, ...updates }
  sessionData.updatedAt = Date.now()

  await saveSessionData(sessionData)
}

export async function clearSessionMessages(): Promise<void> {
  const sessionId = await getSessionId()
  const sessionData = (await getSessionData()) || createEmptySession(sessionId)

  sessionData.conversationHistory = []
  sessionData.updatedAt = Date.now()

  await saveSessionData(sessionData)
}

// ============================================================
// Helpers
// ============================================================

export function createEmptySession(id: string): Session {
  return {
    id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    conversationHistory: [],
    memory: createEmptyMemory(id),
  }
}

export function createEmptyMemory(sessionId: string): SessionMemory {
  return {
    sessionId,
    notes: [],
    extractedData: {},
    actions: [],
    preferences: {},
  }
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
