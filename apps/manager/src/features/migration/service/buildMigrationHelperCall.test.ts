import { decodeFunctionData, zeroAddress } from 'viem'
import { describe, expect, it } from 'vitest'

import { MIGRATION_HELPER_ABI } from '../contracts/abis'
import { V2_CONTRACTS } from '../contracts/addresses'
import { dnsEncodeName } from '../utils/dnsEncodeName'
import { buildMigrationHelperCall } from './buildMigrationHelperCall'

const WALLET = '0x1111111111111111111111111111111111111111' as const
const RESOLVER = '0x2222222222222222222222222222222222222222' as const

const input = (
  name: string,
  tokenType:
    | 'unwrapped'
    | 'unlocked'
    | 'locked-2ld'
    | 'locked-child'
    | 'detached-child',
  parentName: string | null,
) => ({
  name,
  tokenType,
  parentName,
  data: {
    label: name.split('.')[0] ?? name,
    owner: WALLET,
    subregistry: zeroAddress,
    resolver: RESOLVER,
  },
})

describe('buildMigrationHelperCall', () => {
  it('groups mixed token types into one helper migration', () => {
    const call = buildMigrationHelperCall([
      input('unwrapped.eth', 'unwrapped', 'eth'),
      input('unlocked.eth', 'unlocked', 'eth'),
      input('locked.eth', 'locked-2ld', 'eth'),
      input('first.parent.eth', 'locked-child', 'parent.eth'),
      input('second.parent.eth', 'detached-child', 'parent.eth'),
      input('nested.other.eth', 'locked-child', 'other.eth'),
    ])

    expect(call.to).toBe(V2_CONTRACTS.MigrationHelper)
    expect(call.value).toBe(0n)
    const decoded = decodeFunctionData({
      abi: MIGRATION_HELPER_ABI,
      data: call.data,
    })
    expect(decoded.functionName).toBe('migrate')
    const [unwrapped, unlockedGroups, lockedGroups, childGroups] = decoded.args

    expect(unwrapped.map(({ label }) => label)).toEqual(['unwrapped'])
    expect(
      unlockedGroups.map((group) => group.map(({ label }) => label)),
    ).toEqual([['unlocked']])
    expect(
      lockedGroups.map((group) => group.map(({ label }) => label)),
    ).toEqual([['locked']])
    expect(childGroups).toEqual([
      {
        parentName: dnsEncodeName('parent.eth'),
        groups: [
          [
            expect.objectContaining({ label: 'first', owner: WALLET }),
            expect.objectContaining({ label: 'second', owner: WALLET }),
          ],
        ],
      },
      {
        parentName: dnsEncodeName('other.eth'),
        groups: [[expect.objectContaining({ label: 'nested', owner: WALLET })]],
      },
    ])
  })

  it('uses empty helper groups when a batch contains only registrations', () => {
    const decoded = decodeFunctionData({
      abi: MIGRATION_HELPER_ABI,
      data: buildMigrationHelperCall([input('alice.eth', 'unwrapped', 'eth')])
        .data,
    })

    expect(decoded.args.slice(1)).toEqual([[], [], []])
  })

  it('rejects a child without a parent before encoding calldata', () => {
    expect(() =>
      buildMigrationHelperCall([
        input('orphan.parent.eth', 'locked-child', null),
      ]),
    ).toThrow('Child migration "orphan.parent.eth" has no parent name')
  })
})
