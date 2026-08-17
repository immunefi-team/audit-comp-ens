import { describe, expect, it } from 'vitest'
import { getMigrationAvatarUrl } from './nameAvatar.helpers'

describe('getMigrationAvatarUrl', () => {
  it('builds the ENS metadata avatar URL for Sepolia', () => {
    expect(getMigrationAvatarUrl('tagheuer.eth')).toBe(
      'https://metadata.ens.domains/sepolia/avatar/tagheuer.eth',
    )
  })
})
