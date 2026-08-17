// biome-ignore-all lint/suspicious/noExplicitAny: decoded ABI args need flexible typing in tests

import { publicResolverSetAddrSnippet } from '@ensdomains/ensjs-abi/v1/publicResolver'
import { verifiableFactoryDeployProxySnippet } from '@ensdomains/ensjs-abi/v2/verifiableFactory'
import type { Address, Hex } from 'viem'
import { decodeFunctionData, parseAbi } from 'viem'
import { sepolia } from 'viem/chains'
import { describe, expect, it } from 'vitest'
import { getDestinationContracts } from './manifest'
import {
  buildCommitCall,
  buildRevealBatch,
  computeResolverAddress,
} from './registration-calls'

const HCA = '0xaaaa000000000000000000000000000000000001' as const
const WALLET = '0x1111111111111111111111111111111111111111' as const
const RESOLVER = '0x3333333333333333333333333333333333333333' as const
const SECRET = `0x${'7'.repeat(64)}` as Hex
const C = getDestinationContracts(sepolia.id)

const ethRegistrarAbi = parseAbi([
  'function commit(bytes32 commitment)',
  'function register(string label, address owner, bytes32 secret, address subregistry, address resolver, uint64 duration, address paymentToken, bytes32 referrer)',
])
const resolverAbi = parseAbi([
  'function authorizeNameRoles(bytes toName, uint256 roleBitmap, address account, bool grant)',
])
// `PermissionedResolver.initialize` takes a third `bytes[] setters` arg that
// ensjs-abi's `proxyInitializeSnippet` (2-arg) does not model, so it stays local.
const resolverInitAbi = parseAbi([
  'function initialize(address owner, uint256 roles, bytes[] data)',
])

/** ROLES.ALL from contracts-v2 deploy-constants: every nibble = 1. */
const EXPECTED_ROLES_ALL =
  0x1111111111111111111111111111111111111111111111111111111111111111n

describe('computeResolverAddress', () => {
  it('uses the pinned proxy logic to derive the exact CREATE2 address', () => {
    expect(computeResolverAddress({ chainId: sepolia.id, hca: HCA })).toBe(
      '0xcd8d0FAeecC39fbB036c708b697FE4C20c7D41Fd',
    )
  })
})

describe('buildCommitCall', () => {
  it('targets the registrar with value 0', () => {
    const call = buildCommitCall({
      chainId: sepolia.id,
      commitment: `0x${'a'.repeat(64)}` as Hex,
    })
    expect(call.to.toLowerCase()).toBe(C.ethRegistrar.toLowerCase())
    expect(call.value).toBe(0n)
  })
})

describe('buildRevealBatch ordering', () => {
  const base = {
    chainId: sepolia.id,
    hca: HCA as Address,
    resolver: RESOLVER as Address,
    label: 'myname',
    wallet: WALLET as Address,
    secret: SECRET,
    price: 12_345n,
    duration: 28n * 86400n,
  }

  it('omits deployProxy when the resolver already exists; exact tail order', () => {
    const calls = buildRevealBatch({ ...base, resolverDeployed: true })
    // approve → register → setAddr → authorizeNameRoles
    expect(calls).toHaveLength(4)
    expect(calls[0].to.toLowerCase()).toBe(C.usdc.toLowerCase()) // approve
    expect(calls[1].to.toLowerCase()).toBe(C.ethRegistrar.toLowerCase()) // register
    expect(calls[2].to.toLowerCase()).toBe(RESOLVER.toLowerCase()) // setAddr
    // last call is authorizeNameRoles on the resolver
    const last = calls[calls.length - 1]
    const decoded = decodeFunctionData({ abi: resolverAbi, data: last.data })
    expect(decoded.functionName).toBe('authorizeNameRoles')
    // toName is dynamic bytes hex"00" (NOT bytes1), roleBitmap is ROLES.ALL
    // (every nibble = 1, not all bits set).
    expect((decoded.args as any)[0]).toBe('0x00')
    expect((decoded.args as any)[1]).toBe(EXPECTED_ROLES_ALL)
    expect((decoded.args as any)[2].toLowerCase()).toBe(WALLET.toLowerCase())
    expect((decoded.args as any)[3]).toBe(true)
  })

  it('prepends deployProxy with EMPTY initialize setters, records standalone', () => {
    const calls = buildRevealBatch({ ...base, resolverDeployed: false })
    expect(calls[0].to.toLowerCase()).toBe(C.verifiableFactory.toLowerCase())
    // deployProxy → approve → register → setAddr → authorizeNameRoles
    expect(calls).toHaveLength(5)

    // `setters` MUST be empty: HCAOwnerAndSessionValidator rebuilds the
    // expected deployProxy calldata with `initialize(account, ALL_ROLES, [])`
    // and compares keccak hashes. Folding the record writes in here reverts
    // with PolicyRuleFailed() (0xe50c42ea), surfaced as InvalidSignature().
    const deploy = decodeFunctionData({
      abi: verifiableFactoryDeployProxySnippet,
      data: calls[0].data,
    })
    const init = decodeFunctionData({
      abi: resolverInitAbi,
      data: (deploy.args as any)[2] as Hex,
    })
    expect(init.functionName).toBe('initialize')
    expect((init.args as any)[0].toLowerCase()).toBe(HCA.toLowerCase())
    expect((init.args as any)[1]).toBe(EXPECTED_ROLES_ALL)
    expect((init.args as any)[2]).toHaveLength(0)

    // ...and the record write is a standalone, individually-whitelisted call.
    const setAddrCalls = calls.filter(
      (c) =>
        c.to.toLowerCase() === RESOLVER.toLowerCase() &&
        c.data.startsWith('0x8b95dd71'), // setAddr(bytes32,uint256,bytes)
    )
    expect(setAddrCalls).toHaveLength(1)
    const setAddr = decodeFunctionData({
      abi: publicResolverSetAddrSnippet,
      data: setAddrCalls[0].data,
    })
    expect((setAddr.args as any)[1]).toBe(60n) // COIN_TYPE_ETH
    expect(((setAddr.args as any)[2] as string).toLowerCase()).toBe(
      WALLET.toLowerCase(),
    )
  })

  it('issues the record writes as standalone calls when the resolver already exists', () => {
    const calls = buildRevealBatch({ ...base, resolverDeployed: true })
    const setAddrCall = calls.find(
      (c) => c.to.toLowerCase() === RESOLVER.toLowerCase(),
    )
    expect(setAddrCall).toBeDefined()
    const decoded = decodeFunctionData({
      abi: publicResolverSetAddrSnippet,
      // biome-ignore lint/style/noNonNullAssertion: asserted above
      data: setAddrCall!.data,
    })
    expect(decoded.functionName).toBe('setAddr')
    expect(((decoded.args as any)[2] as string).toLowerCase()).toBe(
      WALLET.toLowerCase(),
    )
  })

  it('inserts setNameWithHCA before authorizeNameRoles when a primary name is set', () => {
    const calls = buildRevealBatch({
      ...base,
      resolverDeployed: true,
      setPrimaryName: 'myname.eth',
    })
    const adapterIdx = calls.findIndex(
      (c) =>
        c.to.toLowerCase() ===
        C.defaultReverseRegistrarHcaAdapter.toLowerCase(),
    )
    const authIdx = calls.length - 1
    expect(adapterIdx).toBeGreaterThan(-1)
    expect(adapterIdx).toBeLessThan(authIdx)
  })

  it('registers the wallet (not the HCA) as owner and approves exactly the price', () => {
    const calls = buildRevealBatch({ ...base, resolverDeployed: true })
    const register = calls[1]
    const decoded = decodeFunctionData({
      abi: ethRegistrarAbi,
      data: register.data,
    })
    expect(decoded.functionName).toBe('register')
    expect((decoded.args as any)[1].toLowerCase()).toBe(WALLET.toLowerCase())
    expect((decoded.args as any)[6].toLowerCase()).toBe(C.usdc.toLowerCase())
  })

  it('sets value 0 on every inner call', () => {
    const calls = buildRevealBatch({ ...base, resolverDeployed: false })
    for (const c of calls) expect(c.value).toBe(0n)
  })
})
