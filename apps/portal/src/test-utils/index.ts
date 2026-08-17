/**
 * Test utilities for the portal app
 *
 * Re-exports testing library utilities and custom test helpers
 */

// Re-export testing library utilities
export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'

// Re-export custom test utilities
export * from './providers'
export * from './wagmi.mock'
