import { describe, expect, it } from 'vitest'
import { V1_PROTOCOL } from '../hooks/useNameHistoryTimeline'
import { parseEventData } from '../summarize/decodeRawData'
import { summarizeEvents } from '../summarize/summarizeEvents'
import { adaptV1Events, type V1SubgraphEvent } from './adaptV1Events'

/**
 * Fixtures are the real Sepolia history of `fgeorgescu.eth` — a wrapped v1 name
 * that rendered "No history yet" once the timeline queried the v2 indexer alone.
 */
const NAME = 'fgeorgescu.eth'
const NODE =
  '0x564e75c2afc1acd733909c2e068d9bea4c9d8d79deff34d83d1a8f89b080bbc7' as const
const REGISTER_TX =
  '0x85610efdec2e5d9eff36a48ded1c352ce7f8dd17ed028f062d6e47457eef0231' as const
const RECORDS_TX =
  '0xe9ea0ad16f07591099216afb12790b81763573766eb1f57d54d7ccb56a44767c' as const
const OWNER = '0xa6362dcb7db14c357e788c876ee99e1f982f1115'
const REGISTRANT = '0x0635513f179d50a207757e05759cbd106d7dfce8'
const BLOCK = 9529458

const RESOLVER = '0x8fade66b79cc9f707ab26799354482eb93a5b7dd'
const RESOLVER_ID = `11155111-${RESOLVER}-${NODE}`
const CONTRACTS = {
  registry: '0xBDC85dD5b15D7ecb354cd7cb6f2c50b4f2c4F0E2',
  nameWrapper: '0x0635513f179D50A207757E05759CbD106d7dFcE8',
  baseRegistrar: '0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85',
} as const

const adapt = (
  events: ReadonlyArray<Partial<V1SubgraphEvent> & { type: string }>,
) =>
  adaptV1Events({
    events: events.map((partial) => ({
      id: partial.id ?? '1',
      blockNumber: BLOCK,
      transactionID: REGISTER_TX,
      ...partial,
    })),
    name: NAME,
    namehash: NODE,
    contracts: CONTRACTS,
    blockTimestamps: new Map([
      [BigInt(BLOCK), 1_786_000_000n],
      [9530454n, 1_786_012_000n],
    ]),
  })

describe('adaptV1Events', () => {
  it('stamps protocol, name, namehash and the resolved block timestamp', () => {
    expect(
      adapt([{ type: 'NewOwner', owner: { id: REGISTRANT } }])[0],
    ).toMatchObject({
      type: 'NewOwner',
      protocol: V1_PROTOCOL,
      name: NAME,
      namehash: NODE,
      transactionHash: REGISTER_TX,
      blockNumber: BLOCK,
      timestamp: 1_786_000_000,
    })
  })

  it('maps the registry Transfer to RegistryTransfer, not the ERC-721 Transfer', () => {
    // The v2 `Transfer` descriptor reads asTransfer.from/to and bails on a zero
    // `from` — a registry owner change has neither, so it must not land there.
    const [adapted] = adapt([{ type: 'Transfer', owner: { id: OWNER } }])
    expect(adapted.type).toBe('RegistryTransfer')
    expect(adapted.asRegistryTransfer?.owner).toBe(OWNER)
  })

  it('extracts the resolver address from an ENSNode resolver id', () => {
    const [adapted] = adapt([{ type: 'NewResolver', resolverId: RESOLVER_ID }])
    expect(adapted.type).toBe('ResolverUpdated')
    expect(adapted.asResolverUpdated?.resolver).toBe(RESOLVER)
  })

  it('maps registration and address events onto the shared v2 payloads', () => {
    const [registered, renewed, multicoin] = adapt([
      {
        type: 'NameRegistered',
        expiryDate: '1793442936',
        registrant: { id: REGISTRANT },
      },
      { type: 'NameRenewed', expiryDate: '1801218936' },
      {
        type: 'MulticoinAddrChanged',
        coinType: '2147568180',
        multiaddr: OWNER,
      },
    ])

    expect(registered.asNameRegistered).toMatchObject({
      name: NAME,
      owner: REGISTRANT,
      expires: 1793442936n,
    })
    expect(renewed.asNameRenewed?.expires).toBe(1801218936n)
    expect(multicoin).toMatchObject({
      type: 'AddressChanged',
      asAddressChanged: { address: OWNER, coinType: 2147568180n },
    })
  })

  it('drops the coin-60 MulticoinAddrChanged that duplicates AddrChanged in the same tx', () => {
    const adapted = adapt([
      { type: 'MulticoinAddrChanged', coinType: '60', multiaddr: OWNER },
      { type: 'AddrChanged', addr: { id: OWNER } },
    ])
    expect(adapted).toHaveLength(1)
    expect(adapted[0].type).toBe('AddrChanged')
  })

  it('keeps a coin-60 MulticoinAddrChanged that stands alone', () => {
    const adapted = adapt([
      { type: 'MulticoinAddrChanged', coinType: '60', multiaddr: OWNER },
    ])
    expect(adapted).toHaveLength(1)
    expect(adapted[0].type).toBe('AddressChanged')
  })

  it('serializes unmapped params into the data blob for the detail table', () => {
    const [adapted] = adapt([
      {
        type: 'ContenthashChanged',
        hash: '0xe30101701220abc',
        resolverId: RESOLVER_ID,
      },
    ])
    // `node` and `resolver` are reconstructed — v2 carries them as decoded
    // params and v1 does not, but both are known without another request.
    expect(parseEventData(adapted.data)).toEqual({
      node: NODE,
      resolver: RESOLVER,
      hash: '0xe30101701220abc',
    })
  })
})

describe('parity fields reconstructed without extra requests', () => {
  it('reads the resolver from resolverId on both domain and resolver events', () => {
    const [newResolver, text] = adapt([
      { id: '1', type: 'NewResolver', resolverId: RESOLVER_ID },
      { id: '2', type: 'TextChanged', key: 'a', resolverId: RESOLVER_ID },
    ])

    expect(newResolver.asResolverUpdated?.resolver).toBe(RESOLVER)
    expect(text.asTextChanged?.resolver).toBe(RESOLVER)
  })

  it('keeps on-chain integers exact past Number.MAX_SAFE_INTEGER', () => {
    // uint64 max: `Number('18446744073709551615')` rounds to
    // 18446744073709552000, so the detail table would show a value the chain
    // never emitted.
    const uint64Max = '18446744073709551615'
    const [wrapped, multicoin] = adapt([
      { id: '1', type: 'NameWrapped', expiryDate: uint64Max, fuses: 196608 },
      { id: '2', type: 'MulticoinAddrChanged', coinType: uint64Max },
    ])

    expect(wrapped.asNameWrapped?.expiry).toBe(BigInt(uint64Max))
    expect(String(wrapped.asNameWrapped?.expiry)).toBe(uint64Max)
    expect(wrapped.asNameWrapped?.fuses).toBe(196608n)
    expect(multicoin.asAddressChanged?.coinType).toBe(BigInt(uint64Max))
  })

  it('derives contractAddress per event type from chain constants', () => {
    const byType = Object.fromEntries(
      adapt([
        { id: '1', type: 'NewOwner', owner: { id: REGISTRANT } },
        { id: '2', type: 'NameWrapped', owner: { id: OWNER } },
        { id: '3', type: 'NameRegistered', expiryDate: '1' },
        { id: '4', type: 'TextChanged', key: 'a', resolverId: RESOLVER_ID },
      ]).map((event) => [event.type, event.contractAddress]),
    )

    expect(byType).toEqual({
      NewOwner: CONTRACTS.registry,
      NameWrapped: CONTRACTS.nameWrapper,
      NameRegistered: CONTRACTS.baseRegistrar,
      // Resolver events name their own resolver — a name can change it.
      TextChanged: RESOLVER,
    })
  })

  it('fills resolver and namehash on record payloads', () => {
    const [text, addr] = adapt([
      {
        id: '1',
        type: 'TextChanged',
        key: 'url',
        value: 'x',
        resolverId: RESOLVER_ID,
      },
      {
        id: '2',
        type: 'AddrChanged',
        addr: { id: OWNER },
        resolverId: RESOLVER_ID,
      },
    ])

    expect(text.asTextChanged).toMatchObject({
      key: 'url',
      value: 'x',
      resolver: RESOLVER,
      namehash: NODE,
    })
    expect(addr.asAddressChanged).toMatchObject({
      address: OWNER,
      coinType: 60n,
      resolver: RESOLVER,
      namehash: NODE,
    })
  })

  it('folds the Registration entity cost onto NameRegistered', () => {
    const [adapted] = adapt([
      {
        type: 'NameRegistered',
        expiryDate: '1793442936',
        registrant: { id: REGISTRANT },
        cost: '3125000000000000',
      },
    ])

    expect(adapted.asNameRegistered).toMatchObject({
      cost: '3125000000000000',
    })
    // v2's `label` is a labelhash; v1 only has the plain label, so it stays
    // unset rather than being shown under a bytes32 type.
    expect(adapted.asNameRegistered?.label).toBeUndefined()
  })

  it('keeps the parent name from NewOwner and drops the composite ids', () => {
    const [adapted] = adapt([
      {
        type: 'NewOwner',
        owner: { id: REGISTRANT },
        parentDomain: { name: 'eth' },
      },
    ])

    const params = parseEventData(adapted.data)
    expect(params.parent).toBe('eth')
    expect(params.parentDomain).toBeUndefined()
    expect(params.resolverId).toBeUndefined()
  })
})

describe('summarizeEvents over adapted v1 history', () => {
  // The register transaction writes registration, wrap, resolver and records
  // together — the norm for a v1 registration.
  const REGISTER_EVENTS = [
    { id: 'a', type: 'NewOwner', owner: { id: REGISTRANT } },
    { id: 'b', type: 'WrappedTransfer', owner: { id: OWNER } },
    {
      id: 'c',
      type: 'NameWrapped',
      fuses: 196608,
      expiryDate: '1801218936',
      owner: { id: OWNER },
    },
    { id: 'd', type: 'NewResolver', resolverId: RESOLVER_ID },
    {
      id: 'e',
      type: 'NameRegistered',
      expiryDate: '1793442936',
      registrant: { id: REGISTRANT },
    },
    { id: 'f', type: 'TextChanged', key: 'com.twitter', value: 'fgeo91' },
    { id: 'g', type: 'TextChanged', key: 'com.github', value: 'Malak67' },
    { id: 'h', type: 'MulticoinAddrChanged', coinType: '60', multiaddr: OWNER },
    { id: 'i', type: 'AddrChanged', addr: { id: OWNER } },
  ]
  const RECORD_EVENTS = [
    {
      id: 'j',
      type: 'MulticoinAddrChanged',
      blockNumber: 9530454,
      transactionID: RECORDS_TX,
      coinType: '2147568180',
      multiaddr: OWNER,
    },
    {
      id: 'k',
      type: 'MulticoinAddrChanged',
      blockNumber: 9530454,
      transactionID: RECORDS_TX,
      coinType: '2147905262',
      multiaddr: OWNER,
    },
  ]

  const actions = () =>
    summarizeEvents(adapt([...REGISTER_EVENTS, ...RECORD_EVENTS]))

  it('produces one action per transaction, newest first', () => {
    expect(actions().map((action) => action.txHash)).toEqual([
      RECORDS_TX,
      REGISTER_TX,
    ])
  })

  it('headlines the registration transaction as a register, not a record write', () => {
    const [, register] = actions()
    expect(register.label).toBe('Register name')
    expect(register.icon).toBe('register')
    // The duplicate coin-60 write is gone; the other eight events survive.
    expect(register.events).toHaveLength(8)
  })

  it('summarizes a pure record transaction with the multi-record recipe', () => {
    expect(actions()[0].label).toBe('Set 2 records')
  })
})

describe('v1 descriptors', () => {
  const label = (partial: Partial<V1SubgraphEvent> & { type: string }) =>
    summarizeEvents(adapt([partial]))[0].label

  it('labels NameWrapped as a wrap rather than the v2 migration', () => {
    expect(label({ type: 'NameWrapped', owner: { id: OWNER } })).toBe(
      'Wrap name',
    )
  })

  it('labels NameUnwrapped as an unwrap', () => {
    expect(label({ type: 'NameUnwrapped', owner: { id: OWNER } })).toBe(
      'Unwrap name',
    )
  })

  it('describes v1-only types instead of falling back to the humanized type', () => {
    expect(label({ type: 'NewOwner', owner: { id: REGISTRANT } })).toBe(
      'Set registry owner',
    )
    expect(label({ type: 'WrappedTransfer', owner: { id: OWNER } })).toBe(
      'Transfer wrapped name',
    )
  })

  it('reuses the shared descriptor where v1 and v2 agree', () => {
    expect(label({ type: 'FusesSet', fuses: 65536 })).toBe('Set fuses')
  })
})

describe('v2 events are unaffected', () => {
  it('still labels NameWrapped as the migration', () => {
    const [action] = summarizeEvents([
      {
        id: '1',
        type: 'NameWrapped',
        protocol: 'v2',
        transactionHash: REGISTER_TX,
        blockNumber: 1,
        timestamp: 1,
      },
    ])
    expect(action.label).toBe('Migrated to ENSv2')
  })
})
