// biome-ignore-all lint/suspicious/noExplicitAny: focused machine tests use compact fixtures
import type { Address } from 'viem'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assign, createActor, createMachine } from 'xstate'

/**
 * Events the stubbed registration child accepts. `FORCE_*` are test-only
 * drivers with no counterpart on the real machine. Declared at module scope so
 * `sendToChild` can type its callers against it — types are erased, so the
 * hoisted `vi.mock` factory below can still reference it.
 */
type RegistrationStubEvent =
  | { type: 'START_REGISTRATION'; primaryName?: string }
  | { type: 'FORCE_SUCCESS' }
  | { type: 'FORCE_ERROR'; error: Error }
  | { type: 'RETRY' }

vi.mock('@ens-apps/transaction-manager', () => ({
  registrationMachine: createMachine({
    id: 'registrationStub',
    types: {} as { events: RegistrationStubEvent },
    context: {
      resolverAddress: undefined as Address | undefined,
      resolverTxId: 'tx-resolver',
      commitmentTxId: 'tx-commit',
      approvalTxId: 'tx-approve',
      registrationTxId: 'tx-register',
      registerReadyTimestamp: null as number | null,
      error: undefined as Error | undefined,
      retryCount: 0,
      primaryName: undefined as string | undefined,
    },
    initial: 'idle',
    states: {
      idle: {
        on: {
          START_REGISTRATION: {
            target: 'running',
            actions: assign({
              primaryName: ({ event }) =>
                event.type === 'START_REGISTRATION'
                  ? event.primaryName
                  : undefined,
            }),
          },
          RETRY: {
            actions: assign({
              retryCount: ({ context }) => context.retryCount + 1,
            }),
          },
        },
      },
      running: {
        on: {
          FORCE_SUCCESS: {
            target: 'success',
            actions: assign({
              resolverAddress: () =>
                '0x9999999999999999999999999999999999999999' as Address,
            }),
          },
          FORCE_ERROR: {
            target: 'error',
            actions: assign({
              error: ({ event }) =>
                event.type === 'FORCE_ERROR' ? event.error : undefined,
            }),
          },
          RETRY: {
            actions: assign({
              retryCount: ({ context }) => context.retryCount + 1,
            }),
          },
        },
      },
      success: {},
      error: {},
    },
  }),
  waitForTransaction: vi.fn(async () => ({ hash: '0xhash' })),
}))

vi.mock('../service/syncEthAddressRecord', () => ({
  startSyncEthAddressRecordTransaction: vi.fn(async () => 'tx-eth-record'),
}))

vi.mock('../../profile/service/setPrimaryName', () => ({
  submitPrimaryNameForward: vi.fn(() => 'tx-primary-forward'),
  submitPrimaryNameReverse: vi.fn(() => 'tx-primary-reverse'),
  // Default to a clean owner: the cleanup pass is a no-op for anyone who has
  // never set an `addr.reverse` name, which is the common case.
  hasStaleAddrReverse: vi.fn(async () => false),
  submitClearAddrReverse: vi.fn(() => 'tx-addr-reverse-clear'),
}))

vi.mock('@/features/shared/registration/pricing', () => ({
  MIN_REGISTER_DURATION_SECONDS: 2_419_200,
}))

vi.mock('@/lib/wagmi', () => ({
  publicClient: { chain: { id: 11155111 } },
}))

vi.mock('@/utils/router/root-context', () => ({
  getQueryClient: () => undefined,
}))

import { waitForTransaction } from '@ens-apps/transaction-manager'
import type { SmartAccountContextValue } from '@/lib/smart-account/SmartAccountContext'
import {
  hasStaleAddrReverse,
  submitClearAddrReverse,
  submitPrimaryNameForward,
  submitPrimaryNameReverse,
} from '../../profile/service/setPrimaryName'
import { startSyncEthAddressRecordTransaction } from '../service/syncEthAddressRecord'
import {
  getRegistrationV2ChildActor,
  registrationV2UiMachine,
} from './registrationUi.machine'

const waitForKnownTransaction = vi.mocked(waitForTransaction)
const startSyncEthRecord = vi.mocked(startSyncEthAddressRecordTransaction)
const startPrimaryNameForward = vi.mocked(submitPrimaryNameForward)
const startPrimaryNameReverse = vi.mocked(submitPrimaryNameReverse)
const checkStaleAddrReverse = vi.mocked(hasStaleAddrReverse)
const startAddrReverseClear = vi.mocked(submitClearAddrReverse)

const HCA_ADDRESS = '0x1111111111111111111111111111111111111111' as const
const EOA_ADDRESS = '0x2222222222222222222222222222222222222222' as const

const startEvent = (
  account: SmartAccountContextValue,
  setup:
    | false
    | {
        enabled: boolean
        syncEthRecord?: boolean
      } = false,
) =>
  ({
    type: 'registration.start' as const,
    label: 'example',
    duration: 31_536_000n,
    token: 'USDC',
    totalPrice: 1_000_000n,
    account,
    basePriceNumber: 1,
    premiumPriceNumber: 0,
    postRegistrationSetup: setup
      ? {
          primaryName: {
            enabled: setup.enabled,
            syncEthRecord: setup.syncEthRecord,
          },
        }
      : undefined,
  }) as const

const startActorInTokens = () => {
  const actor = createActor(registrationV2UiMachine, {
    input: { chainId: 11155111 },
  })
  actor.start()
  actor.send({ type: 'pricing.step.next' })
  return actor
}

const getChild = (actor: ReturnType<typeof startActorInTokens>) => {
  const child = getRegistrationV2ChildActor(actor.getSnapshot())
  if (!child) throw new Error('registration child actor missing')
  return child
}

/**
 * Drives the stubbed child. `getRegistrationV2ChildActor` is typed against the
 * real `registrationMachine`, whose event union has no test-only `FORCE_*`
 * members — but under `vi.mock` the running child is the stub above. Confining
 * that mismatch to one cast here keeps every call site checked against
 * `RegistrationStubEvent`, so a change to the stub's events breaks the tests
 * instead of compiling silently.
 */
const sendToChild = (
  actor: ReturnType<typeof startActorInTokens>,
  event: RegistrationStubEvent,
) => {
  const child = getChild(actor) as unknown as {
    send: (event: RegistrationStubEvent) => void
  }
  child.send(event)
}

const deferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const flush = async (times = 8) => {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve()
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('registrationV2UiMachine — HCA approval-signer guard', () => {
  it('fails fast when an HCA registration has no owner wallet client', () => {
    const actor = startActorInTokens()

    actor.send(
      startEvent({
        signer: { type: 'rhinestone' } as any,
        accountAddress: HCA_ADDRESS,
        ownerAddress: EOA_ADDRESS,
        walletClient: null,
      } as unknown as SmartAccountContextValue),
    )

    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('failure')
    expect(snapshot.context.lastErrorMessage).toMatch(/reconnect your wallet/i)
  })

  it('proceeds when an HCA registration has an owner wallet client', () => {
    const actor = startActorInTokens()

    actor.send(
      startEvent({
        signer: { type: 'rhinestone' } as any,
        accountAddress: HCA_ADDRESS,
        ownerAddress: EOA_ADDRESS,
        walletClient: { account: { address: EOA_ADDRESS } } as any,
      } as unknown as SmartAccountContextValue),
    )

    expect(actor.getSnapshot().matches('registering')).toBe(true)
  })

  it('does not fail fast for a pure-EOA registration without a wallet client', () => {
    const actor = startActorInTokens()

    actor.send(
      startEvent({
        signer: { type: 'eoa' } as any,
        accountAddress: EOA_ADDRESS,
        ownerAddress: EOA_ADDRESS,
        walletClient: null,
      } as unknown as SmartAccountContextValue),
    )

    expect(actor.getSnapshot().matches('registering')).toBe(true)
  })
})

describe('registrationV2UiMachine — explicit post-registration states', () => {
  const eoaAccount = {
    signer: { type: 'eoa', walletClient: {} as never },
    accountAddress: EOA_ADDRESS,
    ownerAddress: EOA_ADDRESS,
    // Primary-name legs are sent by the owner wallet, so it must be present.
    walletClient: { account: { address: EOA_ADDRESS } } as any,
  } as unknown as SmartAccountContextValue

  const smartAccount = {
    signer: {
      type: 'rhinestone',
      account: {} as never,
      config: { accountAddress: HCA_ADDRESS, rhinestoneApiKey: 'k' },
    },
    accountAddress: HCA_ADDRESS,
    ownerAddress: EOA_ADDRESS,
    walletClient: { account: { address: EOA_ADDRESS } } as any,
  } as unknown as SmartAccountContextValue

  it('keeps the existing no-setup success path immediate', async () => {
    const actor = startActorInTokens()
    actor.send(startEvent(eoaAccount))

    sendToChild(actor, { type: 'FORCE_SUCCESS' })
    await flush()

    expect(
      actor.getSnapshot().matches({ registering: { transaction: 'success' } }),
    ).toBe(true)
    expect(startSyncEthRecord).not.toHaveBeenCalled()
  })

  it('enters explicit post-registration states when setup exists', async () => {
    const fwdWait = deferred()
    waitForKnownTransaction.mockReturnValueOnce(fwdWait.promise as never)

    const actor = startActorInTokens()
    actor.send(startEvent(eoaAccount, { enabled: true, syncEthRecord: false }))
    sendToChild(actor, { type: 'FORCE_SUCCESS' })
    await flush()

    const snap = actor.getSnapshot()
    expect(
      snap.matches({
        registering: { transaction: 'waitingForPrimaryNameForward' },
      }),
    ).toBe(true)
    expect(startSyncEthRecord).not.toHaveBeenCalled()
    expect(startPrimaryNameForward).toHaveBeenCalled()
  })

  it('stores the ETH record tx id before waiting for confirmation', async () => {
    const wait = deferred<{ hash: '0xhash' }>()
    startSyncEthRecord.mockResolvedValueOnce('tx-eth-record')
    waitForKnownTransaction.mockReturnValueOnce(wait.promise as never)

    const actor = startActorInTokens()
    actor.send(startEvent(eoaAccount, { enabled: true, syncEthRecord: true }))
    sendToChild(actor, { type: 'FORCE_SUCCESS' })
    await flush()

    expect(actor.getSnapshot().context.ethRecordSyncTxId).toBe('tx-eth-record')
    expect(startSyncEthRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'example.eth',
      }),
    )
    expect(
      actor
        .getSnapshot()
        .matches({ registering: { transaction: 'waitingForEthRecordSync' } }),
    ).toBe(true)
  })

  it('runs the EOA primary-name flow as forward then reverse', async () => {
    startSyncEthRecord.mockResolvedValueOnce('tx-eth-record')
    waitForKnownTransaction
      .mockResolvedValueOnce({ hash: '0xeth' } as never)
      .mockResolvedValueOnce({ hash: '0xforward' } as never)
      .mockReturnValueOnce(deferred<{ hash: '0xreverse' }>().promise as never)

    const actor = startActorInTokens()
    actor.send(startEvent(eoaAccount, { enabled: true, syncEthRecord: true }))
    sendToChild(actor, { type: 'FORCE_SUCCESS' })
    await flush(16)

    expect(startPrimaryNameForward).toHaveBeenCalledTimes(1)
    expect(startPrimaryNameReverse).toHaveBeenCalledTimes(1)
    expect(actor.getSnapshot().context.primaryNameTxId).toBe(
      'tx-primary-reverse',
    )
    expect(
      actor.getSnapshot().matches({
        registering: { transaction: 'waitingForPrimaryNameReverse' },
      }),
    ).toBe(true)
  })

  it('sets the primary name inside the HCA bundle and skips the EOA legs', async () => {
    // The reveal batch sets the ETH addr record and the primary name via the
    // reverse-registrar adapter, so no post-registration EOA setup runs.
    const actor = startActorInTokens()
    actor.send(startEvent(smartAccount, { enabled: true, syncEthRecord: true }))

    expect(getChild(actor).getSnapshot().context.primaryName).toBe(
      'example.eth',
    )

    sendToChild(actor, { type: 'FORCE_SUCCESS' })
    await flush(16)

    expect(startSyncEthRecord).not.toHaveBeenCalled()
    expect(startPrimaryNameForward).not.toHaveBeenCalled()
    expect(startPrimaryNameReverse).not.toHaveBeenCalled()
    // The cleanup pass still runs, but finds nothing to clear and so never
    // prompts the wallet.
    expect(checkStaleAddrReverse).toHaveBeenCalledTimes(1)
    expect(startAddrReverseClear).not.toHaveBeenCalled()
    expect(actor.getSnapshot().context.postRegistrationSetupFailed).toBe(false)
    expect(
      actor.getSnapshot().matches({ registering: { transaction: 'success' } }),
    ).toBe(true)
  })

  it('clears a shadowing addr.reverse from the owner EOA after an HCA bundle', async () => {
    // `addr.reverse` outranks the `default.reverse` claim the reveal batch
    // made, so without this the new primary name never resolves.
    checkStaleAddrReverse.mockResolvedValueOnce(true)
    waitForKnownTransaction.mockReturnValueOnce(
      deferred<{ hash: '0xclear' }>().promise as never,
    )

    const actor = startActorInTokens()
    actor.send(startEvent(smartAccount, { enabled: true, syncEthRecord: true }))
    sendToChild(actor, { type: 'FORCE_SUCCESS' })
    await flush(16)

    expect(startAddrReverseClear).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerAddress: EOA_ADDRESS,
        signer: expect.objectContaining({ type: 'eoa' }),
      }),
    )
    expect(actor.getSnapshot().context.addrReverseClearTxId).toBe(
      'tx-addr-reverse-clear',
    )
    expect(
      actor.getSnapshot().matches({
        registering: { transaction: 'waitingForAddrReverseClear' },
      }),
    ).toBe(true)
  })

  it('reaches success once the addr.reverse clear confirms', async () => {
    checkStaleAddrReverse.mockResolvedValueOnce(true)
    waitForKnownTransaction.mockResolvedValueOnce({ hash: '0xclear' } as never)

    const actor = startActorInTokens()
    actor.send(startEvent(smartAccount, { enabled: true, syncEthRecord: true }))
    sendToChild(actor, { type: 'FORCE_SUCCESS' })
    await flush(16)

    // Attempted exactly once — the decision state is re-entered afterwards and
    // must not loop back into the clear.
    expect(startAddrReverseClear).toHaveBeenCalledTimes(1)
    expect(actor.getSnapshot().context.postRegistrationSetupFailed).toBe(false)
    expect(
      actor.getSnapshot().matches({ registering: { transaction: 'success' } }),
    ).toBe(true)
  })

  it('skips the addr.reverse cleanup when no primary name was bundled', async () => {
    const actor = startActorInTokens()
    actor.send(startEvent(smartAccount))
    sendToChild(actor, { type: 'FORCE_SUCCESS' })
    await flush(16)

    expect(checkStaleAddrReverse).not.toHaveBeenCalled()
    expect(
      actor.getSnapshot().matches({ registering: { transaction: 'success' } }),
    ).toBe(true)
  })

  it('still succeeds when the addr.reverse clear is rejected', async () => {
    checkStaleAddrReverse.mockRejectedValueOnce(new Error('user rejected'))

    const actor = startActorInTokens()
    actor.send(startEvent(smartAccount, { enabled: true, syncEthRecord: true }))
    sendToChild(actor, { type: 'FORCE_SUCCESS' })
    await flush(16)

    // The name is registered and the default claim is written; only the
    // cleanup failed, so this is a flagged success, not a failure.
    expect(actor.getSnapshot().context.postRegistrationSetupFailed).toBe(true)
    expect(
      actor.getSnapshot().matches({ registering: { transaction: 'success' } }),
    ).toBe(true)
  })

  it('does not put a primary name in the bundle when the user opted out', () => {
    const actor = startActorInTokens()
    actor.send(startEvent(smartAccount))

    expect(getChild(actor).getSnapshot().context.primaryName).toBeUndefined()
  })

  it('completes successfully after post-registration setup', async () => {
    startSyncEthRecord.mockResolvedValueOnce('tx-eth-record')
    waitForKnownTransaction
      .mockResolvedValueOnce({ hash: '0xeth' } as never)
      .mockResolvedValueOnce({ hash: '0xforward' } as never)
      .mockResolvedValueOnce({ hash: '0xreverse' } as never)

    const actor = startActorInTokens()
    actor.send(startEvent(eoaAccount, { enabled: true, syncEthRecord: true }))
    sendToChild(actor, { type: 'FORCE_SUCCESS' })
    await flush(20)

    expect(
      actor.getSnapshot().matches({ registering: { transaction: 'success' } }),
    ).toBe(true)
  })

  it('completes successfully when post-registration setup fails', async () => {
    // The name is already registered, so a failed optional setup step must not
    // surface as a failed registration.
    startSyncEthRecord.mockRejectedValueOnce(new Error('post setup failed'))

    const actor = startActorInTokens()
    actor.send(startEvent(eoaAccount, { enabled: true, syncEthRecord: true }))
    sendToChild(actor, { type: 'FORCE_SUCCESS' })
    await flush()

    expect(actor.getSnapshot().matches('failure')).toBe(false)
    expect(
      actor.getSnapshot().matches({ registering: { transaction: 'success' } }),
    ).toBe(true)
  })

  it('marks setup failed when the owner wallet client is missing', async () => {
    // Setup was requested but the primary-name legs can't be sent without the
    // owner wallet: registration still succeeds, with the failure notice.
    const noWalletAccount = {
      ...eoaAccount,
      walletClient: null,
    } as unknown as SmartAccountContextValue

    const actor = startActorInTokens()
    actor.send(startEvent(noWalletAccount, { enabled: true }))
    sendToChild(actor, { type: 'FORCE_SUCCESS' })
    await flush()

    expect(startPrimaryNameForward).not.toHaveBeenCalled()
    expect(
      actor.getSnapshot().matches({ registering: { transaction: 'success' } }),
    ).toBe(true)
    expect(actor.getSnapshot().context.postRegistrationSetupFailed).toBe(true)
  })

  it('marks setup failed when the wallet no longer controls the owner address', async () => {
    // The wallet client and owner address are captured together but can
    // diverge if the user switches accounts mid-registration: skip the legs
    // (they would fail at the transport) and surface the failure notice.
    const divergedAccount = {
      ...eoaAccount,
      walletClient: {
        account: { address: '0x9999999999999999999999999999999999999999' },
      } as any,
    } as unknown as SmartAccountContextValue

    const actor = startActorInTokens()
    actor.send(startEvent(divergedAccount, { enabled: true }))
    sendToChild(actor, { type: 'FORCE_SUCCESS' })
    await flush()

    expect(startPrimaryNameForward).not.toHaveBeenCalled()
    expect(
      actor.getSnapshot().matches({ registering: { transaction: 'success' } }),
    ).toBe(true)
    expect(actor.getSnapshot().context.postRegistrationSetupFailed).toBe(true)
  })

  it('marks setup failed when the wallet client has no bound account', async () => {
    // Account-less client (mid-reconnect): we can't verify it controls the
    // owner address, so skip the legs and surface the failure notice.
    const accountlessAccount = {
      ...eoaAccount,
      walletClient: {} as any,
    } as unknown as SmartAccountContextValue

    const actor = startActorInTokens()
    actor.send(startEvent(accountlessAccount, { enabled: true }))
    sendToChild(actor, { type: 'FORCE_SUCCESS' })
    await flush()

    expect(startPrimaryNameForward).not.toHaveBeenCalled()
    expect(
      actor.getSnapshot().matches({ registering: { transaction: 'success' } }),
    ).toBe(true)
    expect(actor.getSnapshot().context.postRegistrationSetupFailed).toBe(true)
  })

  it('completes successfully when the primary-name transaction is rejected', async () => {
    // Regression: rejecting the primary-name wallet transaction must not fail
    // the (already successful) registration or loop.
    waitForKnownTransaction.mockRejectedValueOnce(
      new Error('User rejected the request'),
    )

    const actor = startActorInTokens()
    actor.send(startEvent(eoaAccount, { enabled: true }))
    sendToChild(actor, { type: 'FORCE_SUCCESS' })
    await flush(16)

    expect(startPrimaryNameForward).toHaveBeenCalledTimes(1)
    expect(actor.getSnapshot().matches('failure')).toBe(false)
    expect(
      actor.getSnapshot().matches({ registering: { transaction: 'success' } }),
    ).toBe(true)
    expect(actor.getSnapshot().context.postRegistrationSetupFailed).toBe(true)
  })
})
