import { describe, expect, it } from 'vitest'
import { buildNameAvatarUrl, buildNameHeaderUrl } from './profileAvatar'

describe('profile avatar metadata URLs', () => {
  it('builds the Sepolia v2 metadata avatar URL for a name', () => {
    expect(buildNameAvatarUrl('anthropic.eth')).toBe(
      'https://ens-metadata-v2.ensdomains.workers.dev/sepolia/avatar/anthropic.eth',
    )
  })

  it('URL-encodes the name path segment', () => {
    expect(buildNameAvatarUrl('slash/name.eth')).toBe(
      'https://ens-metadata-v2.ensdomains.workers.dev/sepolia/avatar/slash%2Fname.eth',
    )
  })

  it('builds the Sepolia v2 metadata header URL for a name', () => {
    expect(buildNameHeaderUrl('anthropic.eth')).toBe(
      'https://ens-metadata-v2.ensdomains.workers.dev/sepolia/header/anthropic.eth',
    )
  })

  it('URL-encodes the header name path segment', () => {
    expect(buildNameHeaderUrl('slash/name.eth')).toBe(
      'https://ens-metadata-v2.ensdomains.workers.dev/sepolia/header/slash%2Fname.eth',
    )
  })
})
