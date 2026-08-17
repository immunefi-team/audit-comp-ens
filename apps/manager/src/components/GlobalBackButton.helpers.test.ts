import { describe, expect, it } from 'vitest'
import {
  getDefaultGlobalBackButtonConfig,
  resolveGlobalBackButtonConfig,
} from './GlobalBackButton.helpers'

describe('getDefaultGlobalBackButtonConfig', () => {
  it('enables global back on static detail routes', () => {
    const visibleRoutes = [
      '/legal/privacy-policy',
      '/legal/terms-of-use',
      '/legal/trademark-guidelines',
      '/example.eth',
      '/example.eth/',
      '/0x0000000000000000000000000000000000000000',
      '/0x0000000000000000000000000000000000000000/',
      '/payment/add',
      '/payment/list',
      '/notifications',
      '/notifications/',
      '/notifications/settings',
      '/notifications/settings/',
      '/auto-renewal',
      '/auto-renewal/',
      '/wallet',
      '/wallet/',
    ]

    for (const route of visibleRoutes) {
      expect(getDefaultGlobalBackButtonConfig(route)).toEqual({
        fallbackPath: '/',
        isVisible: true,
      })
    }
  })

  it('does not enable global back on primary, stateful, or internal routes', () => {
    const hiddenRoutes = [
      '/',
      '/dashboard',
      '/migration',
      '/register',
      '/register/example.eth',
      '/renew/example.eth',
      '/example',
      '/0x1234',
      '/p/example.eth/edit',
      '/debug/backend',
      '/notifications/channels/email/verify',
    ]

    for (const route of hiddenRoutes) {
      expect(getDefaultGlobalBackButtonConfig(route)).toBeNull()
    }
  })
})

describe('resolveGlobalBackButtonConfig', () => {
  it('uses an explicit hidden config instead of a route default', () => {
    expect(
      resolveGlobalBackButtonConfig({
        config: { isVisible: false },
        pathname: '/example.eth',
      }),
    ).toEqual({ isVisible: false })
  })
})
