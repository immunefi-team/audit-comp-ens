import { ok } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockClient = { chain: { id: 11155111 } }
vi.mock('@/lib/wagmi/helpers', () => ({
  safeGetClient: () => ok(mockClient),
}))

const mockEnsjsGetSubnames = vi.fn()
vi.mock('@ensdomains/ensjs/subgraph', () => ({
  getSubnames: mockEnsjsGetSubnames,
}))

const mockGraphqlRequest = vi.fn()
vi.mock('@/lib/indexer', () => ({
  graphqlIndexerClient: {
    request: mockGraphqlRequest,
  },
}))

const { getSubnames } = await import('./useSubnames')

describe('getSubnames', () => {
  beforeEach(() => {
    mockEnsjsGetSubnames.mockClear()
    mockGraphqlRequest.mockClear()
  })

  it('returns subnames using ensjs for sepolia network', async () => {
    const mockSubnames = [
      {
        name: 'sub.test.eth',
        labelName: 'sub',
        labelhash: '0x1234',
        owner: '0x1234567890123456789012345678901234567890',
      },
    ]
    mockEnsjsGetSubnames.mockResolvedValue(mockSubnames)

    const result = await getSubnames({
      name: 'test.eth',
      protocolVersion: 'ENSv1',
    })

    expect(result._unsafeUnwrap()).toEqual(mockSubnames)
    expect(mockEnsjsGetSubnames).toHaveBeenCalledWith(mockClient, {
      name: 'test.eth',
    })
  })

  it('returns subnames using graphql indexer for namechainSepolia', async () => {
    const mockGraphqlResponse = {
      domains: [
        {
          subdomains: [
            {
              name: 'sub.test.eth',
              labelName: 'sub',
              labelhash: '0xabcd',
              owner: { id: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' },
            },
          ],
        },
      ],
    }
    mockGraphqlRequest.mockResolvedValue(mockGraphqlResponse)

    const result = await getSubnames({
      name: 'test.eth',
      protocolVersion: 'ENSv2',
    })

    expect(result._unsafeUnwrap()).toEqual([
      {
        name: 'sub.test.eth',
        labelName: 'sub',
        labelhash: '0xabcd',
        owner: '0xABcdEFABcdEFabcdEfAbCdefabcdeFABcDEFabCD',
      },
    ])
  })

  it('returns empty array when domain has no subdomains', async () => {
    const mockGraphqlResponse = {
      domains: [{ subdomains: [] }],
    }
    mockGraphqlRequest.mockResolvedValue(mockGraphqlResponse)

    const result = await getSubnames({
      name: 'empty.eth',
      protocolVersion: 'ENSv2',
    })

    expect(result._unsafeUnwrap()).toEqual([])
  })
})
