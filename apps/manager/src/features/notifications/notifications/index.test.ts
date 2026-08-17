import { describe, expect, it } from 'vitest'
import notificationKindRegistry, { getNotificationData } from './index'

describe('notification kind registry', () => {
  it('contains all known backend kinds', () => {
    expect(Object.keys(notificationKindRegistry).sort()).toEqual([
      'alpha-welcome',
      'blog-post',
      'ens-update',
      'name-expiry',
      'name-transferred',
    ])
  })
})

describe('getNotificationData', () => {
  it('returns component and definition for known kind', () => {
    const resolved = getNotificationData('name-expiry')
    expect(resolved.Component).toBeDefined()
    expect(resolved.definition).toBeDefined()
  })

  it('returns undefined component/definition for unknown kind', () => {
    const resolved = getNotificationData('future-kind' as never)
    expect(resolved.Component).toBeUndefined()
    expect(resolved.definition).toBeUndefined()
  })
})
