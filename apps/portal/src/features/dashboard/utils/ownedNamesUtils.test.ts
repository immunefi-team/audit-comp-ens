import { describe, expect, it } from 'vitest'
import {
  filterAndSortOwnedNames,
  is2LD,
  labelCount,
  mergeOwnedNames,
} from './ownedNamesUtils'

describe('labelCount', () => {
  it('returns 2 for 2LD names', () => {
    expect(labelCount('fox.eth')).toBe(2)
    expect(labelCount('arcticfox.eth')).toBe(2)
  })

  it('returns 3+ for subnames', () => {
    expect(labelCount('big.fox.eth')).toBe(3)
    expect(labelCount('mini.arcticfox.eth')).toBe(3)
    expect(labelCount('a.b.c.eth')).toBe(4)
  })

  it('trims whitespace before counting', () => {
    expect(labelCount('  fox.eth  ')).toBe(2)
  })
})

describe('is2LD', () => {
  it('returns true for exactly two labels', () => {
    expect(is2LD('fox.eth')).toBe(true)
    expect(is2LD('arcticfox.eth')).toBe(true)
  })

  it('returns false for subnames', () => {
    expect(is2LD('big.fox.eth')).toBe(false)
    expect(is2LD('mini.fox.eth')).toBe(false)
  })
})

describe('mergeOwnedNames', () => {
  it('merges v1 and v2 lists', () => {
    const v1 = [{ name: 'v1name.eth' }]
    const v2 = [{ name: 'v2name.eth' }]
    expect(mergeOwnedNames(v1, v2)).toEqual([
      { name: 'v1name.eth' },
      { name: 'v2name.eth' },
    ])
  })

  it('deduplicates by name case-insensitively', () => {
    const v1 = [{ name: 'fox.eth' }]
    const v2 = [{ name: 'Fox.eth' }]
    expect(mergeOwnedNames(v1, v2)).toEqual([{ name: 'fox.eth' }])
  })

  it('skips v1 entries with null name', () => {
    const v1 = [{ name: 'a.eth' }, { name: null }, { name: 'b.eth' }]
    const v2: { name: string }[] = []
    expect(mergeOwnedNames(v1, v2)).toEqual([
      { name: 'a.eth' },
      { name: 'b.eth' },
    ])
  })

  it('returns empty when both inputs empty', () => {
    expect(mergeOwnedNames([], [])).toEqual([])
  })
})

describe('filterAndSortOwnedNames', () => {
  const names: { name: string }[] = [
    { name: 'big.fox.eth' },
    { name: 'fox.eth' },
    { name: 'mini.fox.eth' },
    { name: 'arcticfox.eth' },
    { name: 'notif-fox.eth' },
    { name: 'mini.arcticfox.eth' },
  ]

  it('returns empty when search query is empty', () => {
    expect(filterAndSortOwnedNames(names, '')).toEqual([])
    expect(filterAndSortOwnedNames(names, '   ')).toEqual([])
  })

  it('returns empty when query is only a TLD like ".eth"', () => {
    expect(filterAndSortOwnedNames(names, '.eth')).toEqual([])
  })

  it('filters by case-insensitive includes', () => {
    const result = filterAndSortOwnedNames(names, 'fox')
    expect(result.map((d) => d.name)).toContain('fox.eth')
    expect(result.map((d) => d.name)).toContain('big.fox.eth')
    expect(result.map((d) => d.name)).not.toContain('other.eth')
  })

  it('strips TLD suffix so "dom.eth" matches names containing "dom"', () => {
    const owned = [
      { name: 'dominico.eth' },
      { name: 'other.eth' },
      { name: 'dom.eth' },
    ]
    const result = filterAndSortOwnedNames(owned, 'dom.eth')
    const resultNames = result.map((d) => d.name)
    expect(resultNames).toContain('dom.eth')
    expect(resultNames).toContain('dominico.eth')
    expect(resultNames).not.toContain('other.eth')
  })

  it('matches partial label without TLD (e.g. "fre" matches "fresh.eth")', () => {
    const owned = [{ name: 'fresh.eth' }, { name: 'other.eth' }]
    const result = filterAndSortOwnedNames(owned, 'fre')
    expect(result.map((d) => d.name)).toContain('fresh.eth')
    expect(result.map((d) => d.name)).not.toContain('other.eth')
  })

  it('puts 2LD names first, then subnames, alphabetically within each group', () => {
    const result = filterAndSortOwnedNames(names, 'fox')
    const ordered = result.map((d) => d.name)
    // 2LDs that match "fox": arcticfox.eth, fox.eth, notif-fox.eth (notif-fox.eth is 2LD)
    // Subnames: big.fox.eth, mini.fox.eth
    const twoLDs = ordered.filter((n) => n.split('.').length === 2)
    const subnames = ordered.filter((n) => n.split('.').length >= 3)
    expect(twoLDs.length + subnames.length).toBe(ordered.length)
    // All 2LDs should come before any subname
    if (subnames.length > 0 && twoLDs.length > 0) {
      const last2LDIndex = ordered.lastIndexOf(twoLDs[twoLDs.length - 1])
      const firstSubnameIndex = ordered.indexOf(subnames[0])
      expect(last2LDIndex).toBeLessThan(firstSubnameIndex)
    }
    // 2LDs should be sorted alphabetically
    for (let i = 1; i < twoLDs.length; i++) {
      expect(
        twoLDs[i].toLowerCase().localeCompare(twoLDs[i - 1].toLowerCase()),
      ).toBeGreaterThanOrEqual(0)
    }
    // Subnames should be sorted alphabetically
    for (let i = 1; i < subnames.length; i++) {
      expect(
        subnames[i].toLowerCase().localeCompare(subnames[i - 1].toLowerCase()),
      ).toBeGreaterThanOrEqual(0)
    }
  })

  it('sorts 2LDs before subnames when searching "fox.eth" (TLD stripped to "fox")', () => {
    const result = filterAndSortOwnedNames(names, 'fox.eth')
    const ordered = result.map((d) => d.name)
    // Matches all names containing "fox": arcticfox.eth, fox.eth, notif-fox.eth, big.fox.eth, mini.arcticfox.eth, mini.fox.eth
    expect(ordered[0]).toBe('arcticfox.eth')
    expect(ordered[1]).toBe('fox.eth')
    expect(ordered[2]).toBe('notif-fox.eth')
    expect(ordered[3]).toBe('big.fox.eth')
    expect(ordered[4]).toBe('mini.arcticfox.eth')
    expect(ordered[5]).toBe('mini.fox.eth')
  })

  it('handles subname search by stripping only the TLD', () => {
    const result = filterAndSortOwnedNames(names, 'big.fox.eth')
    const ordered = result.map((d) => d.name)
    // Stripped to "big.fox" — matches names containing "big.fox"
    expect(ordered).toContain('big.fox.eth')
  })

  it('respects max option', () => {
    const result = filterAndSortOwnedNames(names, 'fox', { max: 3 })
    expect(result).toHaveLength(3)
  })

  it('trims search query', () => {
    const result = filterAndSortOwnedNames(names, '  fox.eth  ')
    expect(result.length).toBeGreaterThan(0)
    expect(result.map((d) => d.name)).toContain('fox.eth')
  })

  it('preserves long subname labels when matching (test.florin matches test.florin.eth)', () => {
    const owned = [
      { name: 'test.florin.eth' },
      { name: 'testing.eth' },
      { name: 'florin.eth' },
    ]
    const result = filterAndSortOwnedNames(owned, 'test.florin')
    const resultNames = result.map((d) => d.name)
    expect(resultNames).toContain('test.florin.eth')
    expect(resultNames).not.toContain('testing.eth')
    expect(resultNames).not.toContain('florin.eth')
  })

  it('still strips short TLD suffixes (test.eth matches names containing "test")', () => {
    const owned = [
      { name: 'test.eth' },
      { name: 'testing.eth' },
      { name: 'other.eth' },
    ]
    const result = filterAndSortOwnedNames(owned, 'test.eth')
    const resultNames = result.map((d) => d.name)
    expect(resultNames).toContain('test.eth')
    expect(resultNames).toContain('testing.eth')
    expect(resultNames).not.toContain('other.eth')
  })

  it('handles trailing dot by stripping it for matching', () => {
    const owned = [
      { name: 'test.florin.eth' },
      { name: 'testing.eth' },
      { name: 'other.eth' },
    ]
    const result = filterAndSortOwnedNames(owned, 'test.')
    const resultNames = result.map((d) => d.name)
    expect(resultNames).toContain('test.florin.eth')
    expect(resultNames).toContain('testing.eth')
    expect(resultNames).not.toContain('other.eth')
  })
})
