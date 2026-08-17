// Dev-only: install the Anvil-tracking browser clock before any app module
// captures `Date` (no-op unless DEV + VITE_TIME_TRAVEL).
import '@ens-apps/dev-time-travel/setup'
import './lib/temporal-shim'

import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { ErrorMessage } from '@/components/ErrorMessage'
import reportWebVitals from './reportWebVitals.ts'
// Import the generated route tree
import { routeTree } from './routeTree.gen'
import '@/styles/index.css'
import resources from 'virtual:i18next-loader'
import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import { initReactI18next } from 'react-i18next'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    supportedLngs: ['de', 'en', 'fr'],
    resources,
    interpolation: {
      escapeValue: false,
    },
  })

// Create a new router instance
const router = createRouter({
  routeTree,
  context: {},
  defaultPreload: 'intent',
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
  defaultErrorComponent: ({ error }) => {
    // The error page copy points users at the console for details.
    console.error(error)
    return <ErrorMessage className="mt-10" />
  },
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Render the app
const rootElement = document.getElementById('app')
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}

// @ts-expect-error
BigInt.prototype.toJSON = function () {
  // @ts-expect-error
  return JSON.rawJSON(this.toString())
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()
