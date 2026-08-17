import { createMockAuthenticatedState, mockComments } from './dqaMockData.mock'
import type { DqaApi, DqaState } from './types'

/** In-memory mock API for UI development without a DQA server. */
export const createMockDqaApi = (): DqaApi => {
  let state: DqaState = createMockAuthenticatedState()
  const listeners = new Set<(state: DqaState) => void>()

  const notify = () => {
    listeners.forEach((cb) => {
      try {
        cb(state)
      } catch {
        /* ignore subscriber errors */
      }
    })
  }

  return {
    subscribe(cb) {
      listeners.add(cb)
      cb(state)
      return () => listeners.delete(cb)
    },
    getState: () => state,
    setCommentMode(on) {
      state = { ...state, commentMode: on }
      notify()
    },
    async signOut() {
      state = createMockAuthenticatedState({
        authenticated: false,
        user: null,
        commentMode: false,
        activeCommentId: null,
        signInError: null,
      })
      notify()
    },
    startLinearLogin() {
      state = {
        ...state,
        signInError: 'Mock mode — use Dev mode or connect a real DQA server.',
      }
      notify()
    },
    switchLinearAccount() {
      state = createMockAuthenticatedState({
        authenticated: false,
        user: null,
        commentMode: false,
        activeCommentId: null,
        signInError: null,
      })
      notify()
    },
    async devLogin(name) {
      state = createMockAuthenticatedState({
        user: {
          id: 'mock-dev',
          name: name?.trim() || 'Dev',
          color: '#0080bc',
        },
        signInError: null,
      })
      notify()
    },
    async fetchAuthConfig() {
      const authConfig = { oauthConfigured: true, devAllowed: true }
      state = { ...state, authConfig }
      notify()
      return authConfig
    },
    focusComment(id) {
      const comment = mockComments.find((c) => c.id === id)
      if (!comment) return
      state = { ...state, activeCommentId: id }
      notify()
    },
    setActiveComment(id) {
      state = { ...state, activeCommentId: id }
      notify()
    },
  }
}
