import { describe, expect, it } from 'vitest'
import type { ProfileRecords } from '@/features/profile/types'
import {
  formatChainSpecificAddress,
  formatProfileDetailDate,
  getChainSpecificAddresses,
  getMainReceivingAddress,
  getPrimaryContactItems,
  getReceivingAddressChains,
  getSafeProfileLinks,
} from './ProfileView.helpers'

const makeRecords = (
  overrides: Partial<ProfileRecords> = {},
): ProfileRecords => ({
  addresses: [],
  base: {},
  contact: [],
  links: [],
  social: [],
  unknown: [],
  agentRegistrations: [],
  ...overrides,
})

describe('ProfileView helpers', () => {
  it('formats chain-specific addresses with the first and last five characters', () => {
    expect(
      formatChainSpecificAddress('bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'),
    ).toBe('bc1qx...x0wlh')
    expect(formatChainSpecificAddress('DE5opa123456789xyz')).toBe(
      'DE5op...89xyz',
    )
    expect(formatChainSpecificAddress('abc123')).toBe('abc123')
  })

  it('formats dates as compact uppercase labels for mobile', () => {
    expect(formatProfileDetailDate(new Date('2022-11-11T12:00:00Z'))).toBe(
      'NOV.11.2022',
    )
  })

  it('formats dates with the full month and comma for desktop', () => {
    expect(
      formatProfileDetailDate(new Date('2022-11-11T12:00:00Z'), 'desktop'),
    ).toBe('NOVEMBER 11, 2022')
  })

  it('uses the local calendar day when timeZone is "local"', () => {
    const localNov11 = new Date(2022, 10, 11, 12, 0)
    expect(formatProfileDetailDate(localNov11, 'mobile', 'local')).toBe(
      'NOV.11.2022',
    )
    expect(formatProfileDetailDate(localNov11, 'desktop', 'local')).toBe(
      'NOVEMBER 11, 2022',
    )
  })

  it('uses ENSIP-18 primary contact keys before falling back to contact records', () => {
    const records = makeRecords({
      base: {
        'domains.ens.primary-contacts': JSON.stringify([
          'com.twitter',
          'email',
          'missing.record',
        ]),
      },
      contact: [{ key: 'email', value: 'person@example.com' }],
      social: [
        { key: 'com.twitter', value: '@ernieth' },
        { key: 'org.telegram', value: 'erni_eth' },
      ],
    })

    expect(getPrimaryContactItems(records)).toMatchObject([
      {
        displayValue: 'ernieth',
        key: 'com.twitter',
        label: 'X (Twitter)',
      },
      {
        displayValue: 'person@example.com',
        key: 'email',
        label: 'Email Address',
      },
    ])
  })

  it('falls back to the first populated contact and social records when no primary contacts are set', () => {
    const records = makeRecords({
      contact: [
        { key: 'location', value: 'Canada' },
        { key: 'email', value: 'person@example.com' },
      ],
      social: [{ key: 'com.github', value: 'ensdomains' }],
    })

    expect(getPrimaryContactItems(records, 3).map((item) => item.key)).toEqual([
      'location',
      'email',
      'com.github',
    ])
  })

  it('filters unsafe profile links', () => {
    const records = makeRecords({
      links: [
        { name: 'Blog', url: 'https://example.com/blog' },
        { name: 'Bad', url: 'javascript:alert(1)' },
        { name: 'Relative', url: 'example.com' },
      ],
    })

    expect(getSafeProfileLinks(records)).toEqual([
      {
        displayHost: 'example.com',
        href: 'https://example.com/blog',
        name: 'Blog',
        url: 'https://example.com/blog',
      },
      {
        displayHost: 'example.com',
        href: 'https://example.com',
        name: 'Relative',
        url: 'example.com',
      },
    ])
  })

  it('uses ETH as the main receiving address and excludes it from chain-specific addresses', () => {
    const records = makeRecords({
      addresses: [
        { coinType: 0, value: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' },
        { coinType: 60, value: '0x1234567890abcdef1234567890abcdef12345678' },
      ],
    })

    expect(getMainReceivingAddress(records)).toMatchObject({
      coinType: 60,
      notation: 'ETH',
      value: '0x1234567890abcdef1234567890abcdef12345678',
    })
    expect(
      getChainSpecificAddresses(records).map((item) => item.coinType),
    ).toEqual([0])
  })

  it('groups EVM chains sharing the main address as icons and keeps distinct chains separate', () => {
    const evmValue = '0x1234567890abcdef1234567890abcdef12345678'
    const records = makeRecords({
      addresses: [
        { coinType: 60, value: evmValue },
        { coinType: 614, value: evmValue.toUpperCase() }, // Optimism, same address
        { coinType: 0, value: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' },
      ],
    })

    expect(
      getReceivingAddressChains(records).map((item) => item.coinType),
    ).toEqual([60, 614])
    expect(
      getChainSpecificAddresses(records).map((item) => item.coinType),
    ).toEqual([0])
  })

  it('falls back to the first populated address when ETH is not set', () => {
    const records = makeRecords({
      addresses: [
        { coinType: 0, value: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' },
        { coinType: 501, value: '4Nd1mYQwQ6gkQwQ6gkQwQ6gkQwQ6gkQwQ' },
      ],
    })

    expect(getMainReceivingAddress(records)).toMatchObject({
      coinType: 0,
      notation: 'BTC',
    })
    expect(
      getChainSpecificAddresses(records).map((item) => item.coinType),
    ).toEqual([501])
  })
})
