import { zeroAddress } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetOwnerV1 = vi.fn()
const mockGetOwnerV2 = vi.fn()
const mockGetNameRegistries = vi.fn()

const V1_ETH_REGISTRY = '0x00000000000000000000000000000000000e1000'

vi.mock('@ensdomains/ensjs/chain', () => ({
  // resolveEnsOwner only resolves a chain contract for the V1 fallback now;
  // the V2 path reads everything by name via the UniversalResolver.
  getChainContractAddress: () => V1_ETH_REGISTRY,
}))

vi.mock('@ensdomains/ensjs/public/v1', () => ({
  getOwner: (...args: unknown[]) => mockGetOwnerV1(...args),
}))

vi.mock('@ensdomains/ensjs/public/v2', () => ({
  getOwner: (...args: unknown[]) => mockGetOwnerV2(...args),
  getNameRegistries: (...args: unknown[]) => mockGetNameRegistries(...args),
}))

const { resolveEnsOwner } = await import('./resolveEnsOwner')

// findRegistries returns registries leaf-first: [registryOf(leaf),
// registryContaining(leaf), …, root]. The leaf's containing registry (index 1)
// is what resolveEnsOwner reports as `registryAddress`.
const ETH_REGISTRY = '0x00000000000000000000000000000000000e2000'
const LEDGIT_REGISTRY = '0x00000000000000000000000000000000000ce610'
const ROOT_REGISTRY = '0x0000000000000000000000000000000000007007'
const LEAF_OWN_REGISTRY = '0x000000000000000000000000000000000000face'
const OWNER = '0x1111111111111111111111111111111111111111'

const client = { chain: {} } as never

describe('resolveEnsOwner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetOwnerV1.mockResolvedValue(null)
    mockGetOwnerV2.mockResolvedValue(zeroAddress)
    mockGetNameRegistries.mockResolvedValue([zeroAddress, zeroAddress])
  })

  it('resolves a 2LD owner, reporting the .eth registry the leaf lives in', async () => {
    mockGetOwnerV2.mockResolvedValueOnce(OWNER)
    // [ledgit's own subregistry (none), .eth registry, root]
    mockGetNameRegistries.mockResolvedValueOnce([
      zeroAddress,
      ETH_REGISTRY,
      ROOT_REGISTRY,
    ])

    const result = await resolveEnsOwner(client, 'ledgit.eth')

    expect(result).toEqual({
      owner: OWNER,
      registryAddress: ETH_REGISTRY,
      protocolVersion: 'ENSv2',
    })
    expect(mockGetOwnerV2).toHaveBeenCalledWith(client, { name: 'ledgit.eth' })
    expect(mockGetNameRegistries).toHaveBeenCalledWith(client, {
      name: 'ledgit.eth',
    })
  })

  it('resolves a subname owner by name, reporting the parent subregistry', async () => {
    mockGetOwnerV2.mockResolvedValueOnce(OWNER)
    // [alice's own subregistry (none), ledgit's subregistry, .eth, root]
    mockGetNameRegistries.mockResolvedValueOnce([
      zeroAddress,
      LEDGIT_REGISTRY,
      ETH_REGISTRY,
      ROOT_REGISTRY,
    ])

    const result = await resolveEnsOwner(client, 'alice.ledgit.eth')

    // registryAddress (index 1) is the subregistry the leaf actually lives in
    expect(result).toEqual({
      owner: OWNER,
      registryAddress: LEDGIT_REGISTRY,
      protocolVersion: 'ENSv2',
    })
    expect(mockGetOwnerV2).toHaveBeenCalledWith(client, {
      name: 'alice.ledgit.eth',
    })
    expect(mockGetNameRegistries).toHaveBeenCalledWith(client, {
      name: 'alice.ledgit.eth',
    })
  })

  it('resolves a deep name regardless of depth (index 1 is always the parent registry)', async () => {
    mockGetOwnerV2.mockResolvedValueOnce(OWNER)
    // a.b.ledgit.eth → [a's own subregistry (none), b's subregistry, ledgit's, .eth, root]
    mockGetNameRegistries.mockResolvedValueOnce([
      zeroAddress,
      LEDGIT_REGISTRY,
      ETH_REGISTRY,
      ROOT_REGISTRY,
      ROOT_REGISTRY,
    ])

    const result = await resolveEnsOwner(client, 'a.b.ledgit.eth')

    expect(result).toEqual({
      owner: OWNER,
      registryAddress: LEDGIT_REGISTRY,
      protocolVersion: 'ENSv2',
    })
  })

  it('reports a non-zero leaf-own subregistry but still keys off the parent (index 1)', async () => {
    // A leaf that itself has children: index 0 is non-zero, but the registry
    // the leaf *lives in* (where its owner is read) is still index 1.
    mockGetOwnerV2.mockResolvedValueOnce(OWNER)
    mockGetNameRegistries.mockResolvedValueOnce([
      LEAF_OWN_REGISTRY,
      LEDGIT_REGISTRY,
      ETH_REGISTRY,
      ROOT_REGISTRY,
    ])

    const result = await resolveEnsOwner(client, 'parent.ledgit.eth')

    expect(result?.registryAddress).toBe(LEDGIT_REGISTRY)
  })

  it('returns null (available) when the leaf label is unowned', async () => {
    // A null result is intentional: the OG renderer treats it as "available".
    mockGetOwnerV2.mockResolvedValueOnce(zeroAddress)
    mockGetNameRegistries.mockResolvedValueOnce([
      zeroAddress,
      LEDGIT_REGISTRY,
      ETH_REGISTRY,
      ROOT_REGISTRY,
    ])

    const result = await resolveEnsOwner(client, 'unclaimed.ledgit.eth')

    expect(result).toBeNull()
  })

  it('treats a missing parent registry (index 1 zero) as unresolved (null)', async () => {
    // Owner reads non-zero in isolation, but the ancestry chain is broken:
    // the registry the leaf should live in was never deployed.
    mockGetOwnerV2.mockResolvedValueOnce(OWNER)
    mockGetNameRegistries.mockResolvedValueOnce([
      zeroAddress,
      zeroAddress,
      ETH_REGISTRY,
      ROOT_REGISTRY,
    ])

    const result = await resolveEnsOwner(client, 'alice.ledgit.eth')

    expect(result).toBeNull()
  })

  it('does not query the V2 registry for non-.eth names', async () => {
    await resolveEnsOwner(client, 'florin.xyz')

    expect(mockGetNameRegistries).not.toHaveBeenCalled()
    expect(mockGetOwnerV2).not.toHaveBeenCalled()
    expect(mockGetOwnerV1).toHaveBeenCalledWith(client, { name: 'florin.xyz' })
  })

  it('falls back to the V1 registry when V2 has no owner', async () => {
    mockGetOwnerV2.mockResolvedValueOnce(zeroAddress)
    mockGetNameRegistries.mockResolvedValueOnce([
      zeroAddress,
      ETH_REGISTRY,
      ROOT_REGISTRY,
    ])
    mockGetOwnerV1.mockResolvedValueOnce({ owner: OWNER })

    const result = await resolveEnsOwner(client, 'legacy.eth')

    expect(result).toEqual({
      owner: OWNER,
      registryAddress: V1_ETH_REGISTRY,
      protocolVersion: 'ENSv1',
    })
  })
})
