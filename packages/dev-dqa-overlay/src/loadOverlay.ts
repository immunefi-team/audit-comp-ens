import { DQA_LINEAR_ISSUE, DQA_URL } from './config'
import type { DqaApi } from './types'

const SCRIPT_ID = 'dqa-overlay-script'
const HOST_ID = 'dqa-overlay-host'

const waitForDqaApi = (): Promise<DqaApi> =>
  new Promise((resolve, reject) => {
    const deadline = Date.now() + 15_000
    const tick = () => {
      if (window.__DQA__) {
        resolve(window.__DQA__)
        return
      }
      if (Date.now() > deadline) {
        reject(new Error('DQA overlay failed to initialize'))
        return
      }
      window.setTimeout(tick, 50)
    }
    tick()
  })

const teardownStaleOverlay = () => {
  document.getElementById(HOST_ID)?.remove()
  document.getElementById(SCRIPT_ID)?.remove()
  delete window.__DQA__
  delete window.__DQA_OVERLAY__
  delete window.__DQA_EMBED__
}

/** Loads overlay.js in DevDrawer embed mode. Resolves when `window.__DQA__` is ready. */
export const loadDqaOverlay = (): Promise<DqaApi> => {
  if (typeof window === 'undefined') {
    return Promise.reject(
      new Error('DQA overlay requires a browser environment'),
    )
  }

  window.__DQA_EMBED__ = 'drawer'

  if (window.__DQA__) {
    return Promise.resolve(window.__DQA__)
  }

  const existing = document.getElementById(
    SCRIPT_ID,
  ) as HTMLScriptElement | null
  if (
    existing?.getAttribute('data-embed') === 'drawer' &&
    window.__DQA_OVERLAY__
  ) {
    return waitForDqaApi()
  }

  if (existing || window.__DQA_OVERLAY__ || document.getElementById(HOST_ID)) {
    teardownStaleOverlay()
    window.__DQA_EMBED__ = 'drawer'
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    // overlay.js is an ES module, so it can't read data-* attributes off its
    // own tag (`document.currentScript` is null in modules). Config rides on
    // the URL instead and is read back via `import.meta.url`.
    const src = new URL(`${DQA_URL.replace(/\/$/, '')}/overlay.js`)
    src.searchParams.set('embed', 'drawer')
    if (DQA_LINEAR_ISSUE) src.searchParams.set('issue', DQA_LINEAR_ISSUE)
    script.type = 'module'
    script.src = src.toString()
    // Kept for the dedupe check below — the overlay itself no longer reads it.
    script.setAttribute('data-embed', 'drawer')
    script.onload = () => {
      waitForDqaApi().then(resolve).catch(reject)
    }
    script.onerror = () => {
      reject(new Error(`Failed to load DQA overlay from ${script.src}`))
    }
    document.head.appendChild(script)
  })
}
