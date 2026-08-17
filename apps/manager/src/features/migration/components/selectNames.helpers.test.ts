import { describe, expect, it } from 'vitest'
import { makeClassified } from '../service/_fixtures'
import type { ClassifiedName } from '../service/classifyNames'
import type { NameGroup } from '../service/groupByParent'
import {
  collectAllSelectable,
  countVisibleRows,
  filterGroupsBySearch,
  filterOrphansBySearch,
  shouldShowBulkSelection,
  shouldShowNameSearch,
  shouldUseCompactSelectionLayout,
  shouldUseSmallSelectionCard,
  toggleGroup,
  toggleName,
} from './selectNames.helpers'

const name = (
  n: string,
  tokenType: ClassifiedName['tokenType'] = 'unwrapped',
) => makeClassified({ id: n, name: n, label: n.split('.')[0], tokenType })

const group = (parent: string, subs: readonly string[]): NameGroup => ({
  parent: name(parent),
  subnames: subs.map((s) => name(s, 'locked-child')),
})

describe('collectAllSelectable', () => {
  it('unions parents, subnames, and orphans into a single set', () => {
    expect(
      collectAllSelectable(
        [group('a.eth', ['x.a.eth', 'y.a.eth']), group('b.eth', [])],
        [name('o.eth')],
      ),
    ).toEqual(new Set(['a.eth', 'x.a.eth', 'y.a.eth', 'b.eth', 'o.eth']))
  })

  it('returns an empty set for no input', () => {
    expect(collectAllSelectable([], [])).toEqual(new Set())
  })
})

describe('toggleName', () => {
  it('adds when absent, removes when present, preserves others', () => {
    const prev = new Set(['a.eth'])
    expect(toggleName(prev, 'b.eth')).toEqual(new Set(['a.eth', 'b.eth']))
    expect(toggleName(prev, 'a.eth')).toEqual(new Set())
  })

  it('does not mutate the input set', () => {
    const prev = new Set(['a.eth'])
    toggleName(prev, 'b.eth')
    expect(prev).toEqual(new Set(['a.eth']))
  })
})

describe('toggleGroup', () => {
  it('adds parent + all subnames when parent is absent', () => {
    expect(toggleGroup(new Set(), 'a.eth', ['x.a.eth', 'y.a.eth'])).toEqual(
      new Set(['a.eth', 'x.a.eth', 'y.a.eth']),
    )
  })

  it('removes parent + all subnames when parent is present', () => {
    expect(
      toggleGroup(new Set(['a.eth', 'x.a.eth', 'y.a.eth', 'o.eth']), 'a.eth', [
        'x.a.eth',
        'y.a.eth',
      ]),
    ).toEqual(new Set(['o.eth']))
  })
})

describe('filterGroupsBySearch', () => {
  const groups = [
    group('raffy.eth', ['gm.raffy.eth', 'hello.raffy.eth']),
    group('nick.eth', []),
  ]

  it('returns the original list when search is empty', () => {
    expect(filterGroupsBySearch(groups, '')).toBe(groups)
  })

  it('matches by parent name', () => {
    expect(
      filterGroupsBySearch(groups, 'nick').map((g) => g.parent.domain.name),
    ).toEqual(['nick.eth'])
  })

  it('matches by subname', () => {
    expect(
      filterGroupsBySearch(groups, 'gm').map((g) => g.parent.domain.name),
    ).toEqual(['raffy.eth'])
  })

  it('is case-insensitive on lowercased query', () => {
    expect(filterGroupsBySearch(groups, 'raffy')).toHaveLength(1)
  })
})

describe('filterOrphansBySearch', () => {
  const orphans = [name('one.eth'), name('two.eth'), name('three.eth')]

  it('returns the original list when search is empty', () => {
    expect(filterOrphansBySearch(orphans, '')).toBe(orphans)
  })

  it('filters by name substring', () => {
    expect(
      filterOrphansBySearch(orphans, 'one').map((o) => o.domain.name),
    ).toEqual(['one.eth'])
  })
})

describe('countVisibleRows', () => {
  it('counts parent + subnames per group plus orphans', () => {
    expect(
      countVisibleRows(
        [group('a.eth', ['x.a.eth', 'y.a.eth']), group('b.eth', [])],
        [name('o1.eth'), name('o2.eth')],
      ),
    ).toBe(3 + 1 + 2)
  })

  it('is zero for no input', () => {
    expect(countVisibleRows([], [])).toBe(0)
  })
})

describe('shouldShowBulkSelection', () => {
  it('hides bulk selection below 15 names', () => {
    expect(shouldShowBulkSelection(14)).toBe(false)
  })

  it('shows bulk selection at 15 names and above', () => {
    expect(shouldShowBulkSelection(15)).toBe(true)
    expect(shouldShowBulkSelection(16)).toBe(true)
  })
})

describe('shouldShowNameSearch', () => {
  it('hides search for 8 names or fewer', () => {
    expect(shouldShowNameSearch(8)).toBe(false)
  })

  it('shows search for 9 names and above', () => {
    expect(shouldShowNameSearch(9)).toBe(true)
  })
})

describe('shouldUseCompactSelectionLayout', () => {
  it('keeps the roomy layout below 10 names', () => {
    expect(shouldUseCompactSelectionLayout(9)).toBe(false)
  })

  it('uses the compact layout for 10 names and above', () => {
    expect(shouldUseCompactSelectionLayout(10)).toBe(true)
    expect(shouldUseCompactSelectionLayout(15)).toBe(true)
  })
})

describe('shouldUseSmallSelectionCard', () => {
  it('keeps the card normal for zero names', () => {
    expect(shouldUseSmallSelectionCard(0)).toBe(false)
  })

  it('uses a small card for 1-6 names', () => {
    expect(shouldUseSmallSelectionCard(1)).toBe(true)
    expect(shouldUseSmallSelectionCard(6)).toBe(true)
  })

  it('keeps the card normal above 6 names', () => {
    expect(shouldUseSmallSelectionCard(7)).toBe(false)
  })
})
