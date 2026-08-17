import { describe, expect, it } from 'vitest'
import { shouldShowThirdPartyRenewalWarning } from './thirdPartyRenewalWarning'

describe('shouldShowThirdPartyRenewalWarning', () => {
  it('warns when the connected user is not the owner', () => {
    expect(shouldShowThirdPartyRenewalWarning(false)).toBe(true)
  })

  it('does not warn when the connected user owns the name', () => {
    expect(shouldShowThirdPartyRenewalWarning(true)).toBe(false)
  })

  it('does not warn before ownership has been resolved', () => {
    expect(shouldShowThirdPartyRenewalWarning(undefined)).toBe(false)
  })
})
