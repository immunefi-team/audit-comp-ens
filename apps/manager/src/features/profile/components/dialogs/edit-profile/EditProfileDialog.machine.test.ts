import type { RhinestoneSigner } from '@ens-apps/transaction-manager'
import type { Address, PublicClient, WalletClient } from 'viem'
import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import { defaultProfileRecords } from '@/features/profile/utils/transformRecords'
import {
  editProfileDialogMachine,
  type SaveDeps,
} from './EditProfileDialog.machine'

const OWNER = '0x1111111111111111111111111111111111111111' as Address
const ACCOUNT = '0x2222222222222222222222222222222222222222' as Address
const RESOLVER = '0x3333333333333333333333333333333333333333' as Address

const rhinestoneSigner: RhinestoneSigner = {
  type: 'rhinestone',
  account: {} as never,
  config: { accountAddress: ACCOUNT, rhinestoneApiKey: 'k' },
}

const walletClient = {
  account: { address: OWNER },
} as WalletClient

describe('editProfileDialogMachine', () => {
  it('stays in idle editing when save prerequisites are missing', () => {
    const actor = createActor(editProfileDialogMachine, {
      input: { records: defaultProfileRecords },
    })
    actor.start()
    actor.send({ type: 'OPEN', records: defaultProfileRecords })

    actor.send({
      type: 'SAVE_REQUESTED',
      values: defaultProfileRecords,
      deps: {
        accountAddress: null,
        chainId: 1,
        name: 'test.eth',
        owner: undefined,
        ownerAddress: null,
        publicClient: {} as PublicClient,
        signer: null,
      },
    })

    const snapshot = actor.getSnapshot()
    expect(snapshot.matches({ editing: 'idle' })).toBe(true)
    expect(snapshot.context.pendingSave).toBeUndefined()
  })

  it('can show a general field without toggling it back off', () => {
    const actor = createActor(editProfileDialogMachine, {
      input: { records: defaultProfileRecords },
    })
    actor.start()
    actor.send({ type: 'OPEN', records: defaultProfileRecords })

    actor.send({ type: 'SHOW_GENERAL_FIELD', field: 'name' })
    actor.send({ type: 'SHOW_GENERAL_FIELD', field: 'name' })

    expect(actor.getSnapshot().context.visibleFields.has('name')).toBe(true)
  })

  it('queues a setup save when the resolver must be created for a transferred name', () => {
    const actor = createActor(editProfileDialogMachine, {
      input: { records: defaultProfileRecords },
    })
    actor.start()
    actor.send({ type: 'OPEN', records: defaultProfileRecords })

    const eth = '0x4444444444444444444444444444444444444444'
    const nextRecords = {
      ...defaultProfileRecords,
      addresses: [
        {
          coinType: 60,
          value: eth,
        },
      ],
    }

    actor.send({
      type: 'SAVE_REQUESTED',
      values: nextRecords,
      deps: {
        accountAddress: ACCOUNT,
        chainId: 11155111,
        name: 'transferred.eth',
        needsResolverSetup: true,
        owner: OWNER,
        ownerAddress: OWNER,
        publicClient: {} as PublicClient,
        signer: rhinestoneSigner,
      },
    })

    const snapshot = actor.getSnapshot()
    expect(snapshot.matches({ editing: 'saving' })).toBe(true)
    expect(snapshot.context.pendingSave).toMatchObject({
      kind: 'setup',
      name: 'transferred.eth',
      ownerAddress: OWNER,
      ethAddressChanged: true,
      before: { texts: [], coins: [] },
      after: { coins: [{ coinType: 60, value: eth }] },
    })
  })

  it('passes before/after snapshots so setup writes only the edit diff', () => {
    const eth = '0x5555555555555555555555555555555555555555'
    const records = {
      ...defaultProfileRecords,
      resolverAddress: RESOLVER,
      addresses: [{ coinType: 60, value: eth }],
      base: { description: 'previous owner bio' },
    }
    const actor = createActor(editProfileDialogMachine, {
      input: { records },
    })
    actor.start()
    actor.send({ type: 'OPEN', records })

    actor.send({
      type: 'SAVE_REQUESTED',
      values: {
        ...records,
        base: { ...records.base, description: 'edited bio only' },
      },
      deps: {
        accountAddress: ACCOUNT,
        chainId: 11155111,
        name: 'transferred.eth',
        needsResolverSetup: true,
        owner: OWNER,
        ownerAddress: OWNER,
        publicClient: {} as PublicClient,
        signer: rhinestoneSigner,
      },
    })

    const pendingSave = actor.getSnapshot().context.pendingSave
    expect(pendingSave).toMatchObject({
      kind: 'setup',
      ethAddressChanged: false,
      before: {
        texts: [{ key: 'description', value: 'previous owner bio' }],
        coins: [{ coinType: 60, value: eth }],
      },
      after: {
        texts: [{ key: 'description', value: 'edited bio only' }],
        coins: [{ coinType: 60, value: eth }],
      },
    })
    // Local state starts empty; refetch fills on-chain records.
    if (pendingSave?.kind === 'setup') {
      expect(pendingSave.currentRecords.addresses).toEqual([])
      expect(pendingSave.currentRecords.base).toEqual({})
    }
  })

  it('blocks setup saves when a smart-account signer is unavailable', () => {
    const actor = createActor(editProfileDialogMachine, {
      input: { records: defaultProfileRecords },
    })
    actor.start()
    actor.send({ type: 'OPEN', records: defaultProfileRecords })

    actor.send({
      type: 'SAVE_REQUESTED',
      values: defaultProfileRecords,
      deps: {
        accountAddress: ACCOUNT,
        chainId: 11155111,
        name: 'transferred.eth',
        needsResolverSetup: true,
        owner: OWNER,
        ownerAddress: OWNER,
        publicClient: {} as PublicClient,
        signer: {
          type: 'eoa',
          address: OWNER,
        } as never,
      },
    })

    const snapshot = actor.getSnapshot()
    expect(snapshot.matches({ editing: 'idle' })).toBe(true)
    expect(snapshot.context.pendingSave).toBeUndefined()
  })

  const writableRecords = {
    ...defaultProfileRecords,
    resolverAddress: RESOLVER,
    addresses: [
      {
        coinType: 60,
        value: '0x5555555555555555555555555555555555555555',
      },
    ],
  }

  const startWritableUpdate = (deps: Partial<SaveDeps>) => {
    const actor = createActor(editProfileDialogMachine, {
      input: { records: writableRecords },
    })
    actor.start()
    actor.send({ type: 'OPEN', records: writableRecords })

    actor.send({
      type: 'SAVE_REQUESTED',
      values: { ...writableRecords, addresses: [] },
      deps: {
        accountAddress: ACCOUNT,
        chainId: 11155111,
        name: 'owned.eth',
        needsResolverSetup: false,
        owner: OWNER,
        ownerAddress: OWNER,
        publicClient: {} as PublicClient,
        ...deps,
      },
    })

    return actor.getSnapshot()
  }

  it('queues an in-place update as an owner-EOA transaction, never an HCA intent', () => {
    // The HCA signer is present (post-registration it always is) and must be
    // ignored: the resolver authorizes the owner wallet, and the same write as
    // a Rhinestone intent is rejected by the session validator's action policy.
    const snapshot = startWritableUpdate({
      signer: rhinestoneSigner,
      walletClient,
    })

    expect(snapshot.matches({ editing: 'saving' })).toBe(true)
    expect(snapshot.context.pendingSave).toMatchObject({
      kind: 'update',
      params: {
        resolverAddress: RESOLVER,
        name: 'owned.eth',
        signer: { type: 'eoa', walletClient },
        accountAddress: OWNER,
      },
    })
  })

  it('blocks an in-place update when no owner wallet is connected', () => {
    const snapshot = startWritableUpdate({ signer: rhinestoneSigner })

    expect(snapshot.matches({ editing: 'idle' })).toBe(true)
    expect(snapshot.context.pendingSave).toBeUndefined()
  })

  it('blocks an in-place update when the wallet has switched away from the owner', () => {
    // `resolverWriteAccess` probes from `ownerAddress`; sending from a wallet
    // that has since switched accounts would revert on-chain instead of
    // surfacing the not-ready message.
    const snapshot = startWritableUpdate({
      signer: rhinestoneSigner,
      walletClient: {
        account: { address: ACCOUNT },
      } as WalletClient,
    })

    expect(snapshot.matches({ editing: 'idle' })).toBe(true)
    expect(snapshot.context.pendingSave).toBeUndefined()
  })
})
