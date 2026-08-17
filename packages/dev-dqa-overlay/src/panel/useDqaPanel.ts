import { useEffect, useState } from 'react'
import { isDqaMockUiEnabled } from '../config'
import { createMockDqaApi } from '../createMockDqaApi'
import { loadDqaOverlay } from '../loadOverlay'
import type { DqaApi, DqaState } from '../types'

const initialState: DqaState = {
  ready: false,
  loading: true,
  authenticated: false,
  user: null,
  commentMode: false,
  openCount: 0,
  presence: [],
  authConfig: null,
  signInError: null,
  comments: [],
  activeCommentId: null,
  pageIssueRef: null,
}

export type DqaPanelView = {
  readonly state: DqaState
  readonly api: DqaApi | null
  readonly loadError: string | null
  readonly isPreview: boolean
  readonly isMockMode: boolean
}

export const useDqaPanel = (): DqaPanelView => {
  const [state, setState] = useState<DqaState>(initialState)
  const [api, setApi] = useState<DqaApi | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const mockMode = isDqaMockUiEnabled()

  useEffect(() => {
    let unsubscribe: (() => void) | undefined

    if (mockMode) {
      // Reuse an API already attached by DevDrawer (shared Sign in / profile).
      const mockApi = window.__DQA__ ?? createMockDqaApi()
      window.__DQA__ = mockApi
      setApi(mockApi)
      unsubscribe = mockApi.subscribe(setState)
      return () => {
        unsubscribe?.()
      }
    }

    loadDqaOverlay()
      .then((overlayApi) => {
        setApi(overlayApi)
        unsubscribe = overlayApi.subscribe(setState)
      })
      .catch((error: unknown) => {
        setLoadError(error instanceof Error ? error.message : String(error))
        setState((prev) => ({
          ...prev,
          loading: false,
          ready: true,
        }))
      })

    return () => {
      unsubscribe?.()
    }
  }, [mockMode])

  return {
    state,
    api,
    loadError,
    isPreview: mockMode,
    isMockMode: mockMode,
  }
}
