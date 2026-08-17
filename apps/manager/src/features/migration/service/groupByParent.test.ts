import { describe, expect, it } from 'vitest'
import type { ClassifiedName } from './classifyNames'
import { groupByParent } from './groupByParent'

const makeName = (
  fullName: string,
  tokenType: ClassifiedName['tokenType'],
): ClassifiedName => {
  const label = fullName.split('.')[0]
  const parentName = fullName.includes('.')
    ? fullName.split('.').slice(1).join('.')
    : null
  return {
    domain: {
      id: fullName,
      name: fullName,
      labelName: label,
    },
    tokenType,
    label,
    parentName,
    fuses: 0,
    tokenHolder: '0x0000000000000000000000000000000000000001',
    v1ResolverAddress: null,
    resolverStrategy: 'to-owned-permres',
    managerAddress: null,
  } as unknown as ClassifiedName
}

describe('groupByParent', () => {
  it('returns empty groups and orphans for empty input', () => {
    expect(groupByParent([])).toEqual({ groups: [], orphans: [] })
  })

  it('returns 2LDs as roots with empty subname arrays, alphabetical', () => {
    const a = makeName('b.eth', 'unwrapped')
    const b = makeName('a.eth', 'locked-2ld')
    const { groups, orphans } = groupByParent([a, b])
    expect(groups.map((g) => g.parent.domain.name)).toEqual(['a.eth', 'b.eth'])
    expect(groups.every((g) => g.subnames.length === 0)).toBe(true)
    expect(orphans).toEqual([])
  })

  it('groups subnames under eligible parents, sorted alphabetically', () => {
    const parent = makeName('sub1234.eth', 'unwrapped')
    const childA = makeName('gm.sub1234.eth', 'locked-child')
    const childB = makeName('hi.sub1234.eth', 'detached-child')
    const { groups, orphans } = groupByParent([childB, childA, parent])
    expect(groups).toHaveLength(1)
    const first = groups[0]
    if (!first) throw new Error('expected first group')
    expect(first.parent.domain.name).toBe('sub1234.eth')
    expect(first.subnames.map((c) => c.domain.name)).toEqual([
      'gm.sub1234.eth',
      'hi.sub1234.eth',
    ])
    expect(orphans).toEqual([])
  })

  it('surfaces subnames whose parent is not in the eligible list as orphans', () => {
    const orphan = makeName('gm.sub1234.eth', 'locked-child')
    const other = makeName('other.eth', 'unwrapped')
    const { groups, orphans } = groupByParent([orphan, other])
    expect(groups.map((g) => g.parent.domain.name)).toEqual(['other.eth'])
    const first = groups[0]
    if (!first) throw new Error('expected first group')
    expect(first.subnames).toEqual([])
    expect(orphans.map((o) => o.domain.name)).toEqual(['gm.sub1234.eth'])
  })

  it('mixed: multiple roots each with their own subnames, orphan list', () => {
    const root1 = makeName('a.eth', 'unwrapped')
    const root2 = makeName('b.eth', 'locked-2ld')
    const child1 = makeName('x.a.eth', 'locked-child')
    const child2 = makeName('y.a.eth', 'detached-child')
    const child3 = makeName('z.b.eth', 'locked-child')
    const orphan = makeName('o.missing.eth', 'locked-child')
    const { groups, orphans } = groupByParent([
      child2,
      orphan,
      child3,
      root2,
      child1,
      root1,
    ])
    expect(groups.map((g) => g.parent.domain.name)).toEqual(['a.eth', 'b.eth'])
    const [groupA, groupB] = groups
    if (!groupA || !groupB) throw new Error('expected two groups')
    expect(groupA.subnames.map((c) => c.domain.name)).toEqual([
      'x.a.eth',
      'y.a.eth',
    ])
    expect(groupB.subnames.map((c) => c.domain.name)).toEqual(['z.b.eth'])
    expect(orphans.map((o) => o.domain.name)).toEqual(['o.missing.eth'])
  })
})
