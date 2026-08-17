import indexerClient from '@ens-apps/indexer/urql'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getDashboardRoleAssignments,
  getDashboardRoleAssignmentsForAddresses,
} from './getDashboardRoleAssignments'

vi.mock('@ens-apps/indexer/urql', () => ({ default: { query: vi.fn() } }))

const queryMock = vi.mocked(indexerClient.query)

const respond = (response: { data?: unknown; error?: unknown }): void => {
  queryMock.mockReturnValueOnce({
    toPromise: () => Promise.resolve(response),
  } as never)
}

const ADDR = '0x0000000000000000000000000000000000000001'

beforeEach(() => {
  queryMock.mockReset()
})

describe('getDashboardRoleAssignments', () => {
  it('returns role assignments from the indexer', async () => {
    respond({
      data: {
        roles: [
          { name: 'alaska.eth', roleBitmap: '1' },
          { name: null, roleBitmap: '0' },
        ],
      },
    })

    await expect(getDashboardRoleAssignments(ADDR)).resolves.toEqual([
      { name: 'alaska.eth', roleBitmap: '1' },
      { name: null, roleBitmap: '0' },
    ])
  })

  it('lowercases the account variable', async () => {
    respond({ data: { roles: [] } })

    await getDashboardRoleAssignments(
      '0xABCDEF0123456789ABCDEF0123456789ABCDEF01',
    )

    const vars = queryMock.mock.calls[0]?.[1] as { account?: string }
    expect(vars.account).toBe('0xabcdef0123456789abcdef0123456789abcdef01')
  })

  it.each([
    ['error', { error: new Error('indexer 500') }],
    ['no data and no error', {}],
  ] as const)('throws a tagged error on %s', async (_, response) => {
    respond(response)

    await expect(getDashboardRoleAssignments(ADDR)).rejects.toMatchObject({
      _tag: 'GetDashboardRoleAssignmentsError',
    })
  })

  it('fetches assignments for every unique address', async () => {
    respond({ data: { roles: [{ name: 'alaska.eth', roleBitmap: '1' }] } })
    respond({ data: { roles: [{ name: 'figma.eth', roleBitmap: '2' }] } })

    await expect(
      getDashboardRoleAssignmentsForAddresses([
        ADDR,
        '0x0000000000000000000000000000000000000002',
        ADDR.toUpperCase(),
      ]),
    ).resolves.toEqual([
      { name: 'alaska.eth', roleBitmap: '1' },
      { name: 'figma.eth', roleBitmap: '2' },
    ])

    expect(queryMock).toHaveBeenCalledTimes(2)
  })
})
