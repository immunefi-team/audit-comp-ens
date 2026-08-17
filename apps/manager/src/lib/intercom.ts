import { Intercom } from '@intercom/messenger-js-sdk'
import { createIsomorphicFn } from '@tanstack/react-start'

const CLIENT_initializeIntercom = () => {
  // Non-critical: can throw on blocked domains (403). Never crash the app.
  try {
    Intercom({
      app_id: 're9q5yti',
    })
  } catch (error) {
    console.warn('[intercom] init failed', error)
  }
}

export const initializeIntercom = createIsomorphicFn().client(
  CLIENT_initializeIntercom,
)
