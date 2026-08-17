import type { createBrowserInspector } from '@statelyai/inspect'

let inspector: ReturnType<typeof createBrowserInspector> | undefined

if (import.meta.env.DEV && import.meta.env.VITE_INSPECT_XSTATE) {
  const { createBrowserInspector } = await import('@statelyai/inspect')
  inspector = createBrowserInspector()
  console.log('xState inspector created')
}

export const inspect = inspector?.inspect
