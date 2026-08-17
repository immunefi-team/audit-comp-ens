import { describe, expect, it } from 'vitest'
import { buildNameAvatarUrl } from '@/features/profile/service/profileAvatar'
import type { ProfileRecordsResult } from '@/features/profile/service/profileRecords'
import { getNameRowProfilePreview } from './nameRowProfileRecords'

const profileRecords = (
  texts: ProfileRecordsResult['texts'],
): ProfileRecordsResult => ({
  coins: [],
  texts,
})

describe('getNameRowProfilePreview', () => {
  it('marks generated avatar color as pending while profile records are loading', () => {
    expect(
      getNameRowProfilePreview({
        label: 'alaska.eth',
        isLoading: true,
      }).isAvatarPending,
    ).toBe(true)

    expect(
      getNameRowProfilePreview({
        label: 'alaska.eth',
        records: profileRecords([{ key: 'theme', value: '#E72A96' }]),
      }).isAvatarPending,
    ).toBe(false)
  })

  it('uses the profile theme record for themed generated avatars', () => {
    const preview = getNameRowProfilePreview({
      label: 'alaska.eth',
      records: profileRecords([{ key: 'theme', value: '#E72A96' }]),
    })

    expect(preview.themeColor).toBe('#E72A96')
  })

  it('uses the metadata avatar URL only when an explicit avatar record exists', () => {
    expect(
      getNameRowProfilePreview({
        label: 'alaska.eth',
        records: profileRecords([{ key: 'theme', value: '#E72A96' }]),
      }).avatarUrl,
    ).toBeUndefined()

    expect(
      getNameRowProfilePreview({
        label: 'alaska.eth',
        name: 'alaska.eth',
        records: profileRecords([
          { key: 'avatar', value: 'https://example.com/avatar.png' },
        ]),
      }).avatarUrl,
    ).toBe(buildNameAvatarUrl('alaska.eth'))
  })

  it('uses the canonical name for metadata avatar URLs', () => {
    const preview = getNameRowProfilePreview({
      label: 'Display Name',
      name: 'normalized.eth',
      records: profileRecords([
        { key: 'avatar', value: 'https://example.com/avatar.png' },
      ]),
    })

    expect(preview.avatarUrl).toBe(buildNameAvatarUrl('normalized.eth'))
  })
})
