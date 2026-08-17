import type { HcaSessionEnablePayload } from '@ens-apps/smart-account'
import {
  type RegistrationEvent,
  registrationMachine,
  type Signer,
  waitForTransaction,
} from '@ens-apps/transaction-manager'
import type { SUPPORTED_TOKEN } from '@ens-apps/transaction-manager/contracts/ens-sepolia'
import { $qk } from '@ens-apps/utils/tanstack-query/queryKey'
import { match } from 'ts-pattern'
import {
  type Address,
  isAddressEqual,
  type PublicClient,
  type WalletClient,
} from 'viem'
import {
  type ActorRefFrom,
  assign,
  enqueueActions,
  fromPromise,
  raise,
  type SnapshotFrom,
  sendTo,
  setup,
} from 'xstate'
import { profileReverseNameQuery } from '@/features/profile/service/profileReverseName'
import { MIN_REGISTER_DURATION_SECONDS } from '@/features/shared/registration/pricing'
import type { SmartAccountContextValue } from '@/lib/smart-account/SmartAccountContext'
import { publicClient as defaultPublicClient } from '@/lib/wagmi'
import { getQueryClient } from '@/utils/router/root-context'
import {
  hasStaleAddrReverse,
  submitClearAddrReverse,
  submitPrimaryNameForward,
  submitPrimaryNameReverse,
} from '../../profile/service/setPrimaryName'
import { startSyncEthAddressRecordTransaction } from '../service/syncEthAddressRecord'
import { getDurationInSecondsFromYears } from '../utils/time'
import {
  getRegistrationStageProgress,
  type MaxProgressReached,
  REGISTRATION_STAGE_PROGRESS,
  type RegistrationStage,
} from './registration.stages'
import type { RegistrationPostRegistrationSetup } from './registrationAutoSetup'

export const REGISTRATION_V2_ACTOR_ID = 'registrationActor'

type RegistrationSnapshot = SnapshotFrom<typeof registrationMachine>

type PostRegistrationData = {
  label: string
  signer: Signer
  walletClient: WalletClient | null
  accountAddress: Address
  ownerAddress: Address
  publicClient: PublicClient
  chainId: number
  resolverAddress?: Address
}

type PostRegistrationProgress = {
  ethRecordSynced: boolean
  primaryNameForwardConfirmed: boolean
  /**
   * Set once the `addr.reverse` cleanup has run to completion — including the
   * case where nothing needed clearing. Guards on this so the step is
   * attempted exactly once per registration.
   */
  addrReverseClearAttempted: boolean
}

type Context = {
  chainId: number
  duration: number
  selectedToken: SUPPORTED_TOKEN | undefined
  lastErrorMessage?: string
  confirmedData?: {
    label: string
    duration: bigint
    ownerAddress: Address
    token: SUPPORTED_TOKEN
    totalPrice: bigint
    basePriceNumber: number
    premiumPriceNumber: number
  }
  postRegistrationSetup?: RegistrationPostRegistrationSetup
  postRegistrationData?: PostRegistrationData
  postRegistrationProgress: PostRegistrationProgress
  registrationCompleted: boolean
  postRegistrationSetupFailed: boolean
  ethRecordSyncTxId?: string
  primaryNameTxId?: string
  /**
   * The primary name the HCA reveal batch claimed on `default.reverse`, when
   * the user opted in. Its presence is what marks the registration as needing
   * the `addr.reverse` cleanup pass; the EOA path leaves it undefined and
   * handles its own reverse leg.
   */
  hcaPrimaryName?: string
  addrReverseClearTxId?: string
  maxProgressReached?: MaxProgressReached
}

type Events =
  | { type: 'pricing.step.next' }
  | { type: 'pricing.step.previous' }
  | { type: 'pricing.dialog.dismiss' }
  | { type: 'pricing.duration.set'; duration: number }
  | { type: 'pricing.token.select'; token: SUPPORTED_TOKEN | undefined }
  | {
      type: 'registration.start'
      label: string
      duration: bigint
      token: SUPPORTED_TOKEN
      totalPrice: bigint
      account: SmartAccountContextValue
      /**
       * Standalone-HCA session-enable payload, pre-resolved by the caller
       * (`account.getSessionEnablePayload()`). Absent on the pure-EOA path and
       * when the session is already enabled on-chain.
       */
      hcaSessionEnable?: HcaSessionEnablePayload
      basePriceNumber: number
      premiumPriceNumber: number
      postRegistrationSetup?: RegistrationPostRegistrationSetup
    }
  | { type: 'registration.completed' }
  | { type: 'notifications.step.next' }
  | { type: 'transaction.success' }
  | { type: 'transaction.failed'; message?: string }
  | { type: 'retry' }
  | { type: 'cancel' }
  | { type: 'label.changed' }
  | { type: '$error'; error: Error }

type Input = {
  chainId: number
}

const INITIAL_POST_REGISTRATION_PROGRESS: PostRegistrationProgress = {
  ethRecordSynced: false,
  primaryNameForwardConfirmed: false,
  addrReverseClearAttempted: false,
}

const isRegistrationSnapshotEvent = (
  event: unknown,
): event is { snapshot: RegistrationSnapshot } =>
  !!event && typeof event === 'object' && 'snapshot' in event

const shouldSyncEthRecord = (context: Context) =>
  context.postRegistrationSetup?.primaryName?.syncEthRecord === true

const shouldSetPrimaryName = (context: Context) =>
  context.postRegistrationSetup?.primaryName?.enabled === true

const asEthName = (label: string) => `${label}.eth`

// Require a bound account that matches the owner: an account-less client
// (possible mid-reconnect) gives no way to verify the wallet controls the
// owner address, so treat it as unavailable rather than submitting blind.
const hasOwnerWallet = (context: Context) => {
  if (!context.postRegistrationData) return false

  const { walletClient, ownerAddress } = context.postRegistrationData

  return (
    !!walletClient?.account &&
    isAddressEqual(walletClient.account.address, ownerAddress)
  )
}

// EOA fallback only: the HCA path sets the primary name inside the reveal
// batch via the reverse-registrar adapter, so this flow never runs there.
const canSetPrimaryName = (context: Context) =>
  shouldSetPrimaryName(context) && hasOwnerWallet(context)

// HCA path only. The reveal batch claims `default.reverse`, but a leftover
// `addr.reverse` entry shadows it — so the claim silently does nothing until
// that entry is cleared, which only the owner EOA can do (see
// `submitClearAddrReverse`).
const hasAddrReverseClearRemaining = (context: Context) =>
  !!context.hcaPrimaryName &&
  !context.postRegistrationProgress.addrReverseClearAttempted &&
  hasOwnerWallet(context)

const hasPrimaryNameForwardRemaining = (context: Context) =>
  canSetPrimaryName(context) &&
  !context.postRegistrationProgress.primaryNameForwardConfirmed

const hasPrimaryNameReverseRemaining = (context: Context) =>
  canSetPrimaryName(context) &&
  context.postRegistrationProgress.primaryNameForwardConfirmed

const updateMaxProgress = (
  current: MaxProgressReached | undefined,
  stage: RegistrationStage,
): MaxProgressReached => {
  const progress = getRegistrationStageProgress(stage)
  if (current && progress <= current.progress) {
    return current
  }
  return { stage, progress }
}

const machineSetup = setup({
  types: {
    context: {} as Context,
    events: {} as Events,
    input: {} as Input,
    children: {} as {
      [REGISTRATION_V2_ACTOR_ID]: 'registrationFlow'
    },
  },
  actors: {
    registrationFlow: registrationMachine,
    submitEthRecordTransaction: fromPromise(
      async ({ input }: { input: Required<PostRegistrationData> }) =>
        startSyncEthAddressRecordTransaction({
          name: asEthName(input.label),
          ownerAddress: input.ownerAddress,
          resolverAddress: input.resolverAddress,
          signer: input.signer,
          accountAddress: input.accountAddress,
          publicClient: input.publicClient,
          chainId: input.chainId,
        }),
    ),
    waitForKnownTransaction: fromPromise(
      async ({ input }: { input: { txId: string } }) =>
        waitForTransaction(input.txId),
    ),
    // Reads first so the wallet is only prompted when there is genuinely a
    // shadowing entry to clear — most registrations need nothing here, and an
    // unnecessary prompt right after a prompt-free registration is worse than
    // the stale record it would avoid.
    submitAddrReverseClear: fromPromise(
      async ({
        input,
      }: {
        input: {
          ownerAddress: Address
          walletClient: WalletClient
          publicClient: PublicClient
          chainId: number
        }
      }): Promise<{ txId?: string }> => {
        const stale = await hasStaleAddrReverse({
          publicClient: input.publicClient,
          ownerAddress: input.ownerAddress,
        })

        if (!stale) return {}

        return {
          txId: submitClearAddrReverse({
            signer: { type: 'eoa', walletClient: input.walletClient },
            ownerAddress: input.ownerAddress,
            publicClient: input.publicClient,
            chainId: input.chainId,
          }),
        }
      },
    ),
  },
  guards: {
    isDurationValid: ({ context }) =>
      context.duration >= MIN_REGISTER_DURATION_SECONDS,
    hasEthRecordSyncRemaining: ({ context }) =>
      shouldSyncEthRecord(context) &&
      !context.postRegistrationProgress.ethRecordSynced,
    hasPrimaryNameForwardRemaining: ({ context }) =>
      hasPrimaryNameForwardRemaining(context),
    hasPrimaryNameReverseRemaining: ({ context }) =>
      hasPrimaryNameReverseRemaining(context),
    // Setup was requested but the primary-name legs can't be sent (no owner
    // wallet client, or it no longer controls the owner address): surface the
    // failure notice instead of silently reporting success.
    primaryNameSetupUnavailable: ({ context }) =>
      shouldSetPrimaryName(context) &&
      !canSetPrimaryName(context) &&
      !context.postRegistrationProgress.primaryNameForwardConfirmed,
    hasEthRecordSyncTxId: ({ context }) => !!context.ethRecordSyncTxId,
    hasPrimaryNameTxId: ({ context }) => !!context.primaryNameTxId,
    hasAddrReverseClearRemaining: ({ context }) =>
      hasAddrReverseClearRemaining(context),
    // Reads the actor's output, not context: guards run before the
    // transition's actions, so `addrReverseClearTxId` is still unset here.
    addrReverseClearSubmitted: ({ event }) =>
      !!(event as unknown as { output?: { txId?: string } }).output?.txId,
  },
  actions: {
    setDuration: assign({
      duration: ({ event }) =>
        event.type === 'pricing.duration.set'
          ? event.duration
          : getDurationInSecondsFromYears(1),
    }),
    setToken: assign({
      selectedToken: ({ event, context }) =>
        event.type === 'pricing.token.select'
          ? event.token
          : context.selectedToken,
    }),
    clearError: assign({
      lastErrorMessage: () => undefined,
    }),
    clearMaxProgress: assign({
      maxProgressReached: () => undefined,
    }),
    setError: assign({
      lastErrorMessage: ({ event }) =>
        match(event)
          .with({ type: 'transaction.failed' }, ({ message }) => message)
          .with({ type: '$error' }, ({ error }) => error.message)
          .otherwise(() => undefined),
    }),
    setInvokeError: assign({
      lastErrorMessage: ({ event }) => {
        const error = (event as { error?: unknown }).error
        return error instanceof Error ? error.message : String(error)
      },
    }),
    forwardRetry: sendTo(REGISTRATION_V2_ACTOR_ID, { type: 'RETRY' }),
    forwardCancel: sendTo(REGISTRATION_V2_ACTOR_ID, { type: 'CANCEL' }),
    clearRegistrationData: assign({
      confirmedData: () => undefined,
      postRegistrationSetup: () => undefined,
      postRegistrationData: () => undefined,
      postRegistrationProgress: () => INITIAL_POST_REGISTRATION_PROGRESS,
      registrationCompleted: () => false,
      postRegistrationSetupFailed: () => false,
      ethRecordSyncTxId: () => undefined,
      primaryNameTxId: () => undefined,
      hcaPrimaryName: () => undefined,
      addrReverseClearTxId: () => undefined,
    }),
    invalidateNameQueries: ({ context }) => {
      const label = context.confirmedData?.label
      const ownerAddress = context.postRegistrationData?.ownerAddress
      const queryClient = getQueryClient()
      if (!queryClient) return

      if (label) {
        queryClient.invalidateQueries({
          queryKey: $qk({
            name: asEthName(label),
          }),
        })
      }

      if (ownerAddress) {
        queryClient.invalidateQueries({
          queryKey: profileReverseNameQuery(ownerAddress).queryKey,
        })
      }
    },
    updateRegistrationStageFromChild: assign({
      maxProgressReached: ({ context, event }) => {
        if (!isRegistrationSnapshotEvent(event)) {
          return context.maxProgressReached
        }

        const value = event.snapshot.value
        const stage = typeof value === 'string' ? value : String(value)
        if (
          !(stage in REGISTRATION_STAGE_PROGRESS) ||
          context.registrationCompleted
        ) {
          return context.maxProgressReached
        }

        return updateMaxProgress(
          context.maxProgressReached,
          stage as RegistrationStage,
        )
      },
    }),
    captureChildSuccess: enqueueActions(({ enqueue, context, event }) => {
      if (!isRegistrationSnapshotEvent(event)) return

      enqueue.assign({
        registrationCompleted: true,
        postRegistrationData: context.postRegistrationData
          ? {
              ...context.postRegistrationData,
              resolverAddress: event.snapshot.context.resolverAddress,
            }
          : context.postRegistrationData,
      })

      // `hcaPrimaryName` counts here too: the HCA path carries no
      // `postRegistrationSetup`, but it still owes the `addr.reverse` cleanup
      // pass, and skipping straight to success would never run it.
      if (context.postRegistrationSetup || context.hcaPrimaryName) {
        enqueue.raise({ type: 'registration.completed' })
        return
      }

      enqueue.raise({ type: 'transaction.success' })
    }),
    setRegistrationSuccessStage: assign({
      maxProgressReached: ({ context }) =>
        updateMaxProgress(context.maxProgressReached, 'success'),
    }),
    logPostRegistrationSetupError: ({ event }) => {
      const error = (event as { error?: unknown }).error
      console.warn(
        '[REGISTRATION] Optional post-registration setup step did not complete; the name is already registered:',
        error,
      )
    },
    markPostRegistrationSetupFailed: assign({
      postRegistrationSetupFailed: () => true,
    }),
    setPostRegistrationDecisionStage: assign({
      maxProgressReached: ({ context }) =>
        updateMaxProgress(context.maxProgressReached, 'postRegistrationSetup'),
    }),
    setSyncEthRecordStage: assign({
      maxProgressReached: ({ context }) =>
        updateMaxProgress(context.maxProgressReached, 'syncingEthRecord'),
    }),
    setWaitEthRecordStage: assign({
      maxProgressReached: ({ context }) =>
        updateMaxProgress(
          context.maxProgressReached,
          'waitingForEthRecordSync',
        ),
    }),
    setPrimaryNameStage: assign({
      maxProgressReached: ({ context }) =>
        updateMaxProgress(context.maxProgressReached, 'settingPrimaryName'),
    }),
    storeEthRecordSyncTxId: assign({
      ethRecordSyncTxId: ({ event }) =>
        (event as unknown as { output: string }).output,
    }),
    markEthRecordSynced: assign({
      postRegistrationProgress: ({ context }) => ({
        ...context.postRegistrationProgress,
        ethRecordSynced: true,
      }),
    }),
    markPrimaryNameForwardConfirmed: assign({
      postRegistrationProgress: ({ context }) => ({
        ...context.postRegistrationProgress,
        primaryNameForwardConfirmed: true,
      }),
    }),
    storeAddrReverseClearTxId: assign({
      addrReverseClearTxId: ({ event }) =>
        (event as unknown as { output: { txId?: string } }).output.txId,
    }),
    markAddrReverseClearAttempted: assign({
      postRegistrationProgress: ({ context }) => ({
        ...context.postRegistrationProgress,
        addrReverseClearAttempted: true,
      }),
    }),
  },
})

const startRegistrationAction = machineSetup.createAction(
  enqueueActions(({ enqueue, event }) => {
    if (event.type !== 'registration.start') {
      return enqueue.raise({
        type: '$error',
        error: new Error('registration.start event required'),
      })
    }

    if (!event.account.signer || !event.account.accountAddress) {
      return enqueue.raise({
        type: '$error',
        error: new Error('Account not ready'),
      })
    }

    const ownerAddress =
      event.account.ownerAddress ?? event.account.accountAddress

    const resolverOwnerAddress =
      event.account.ownerAddress ?? event.account.accountAddress

    const approvalSigner: Signer | undefined = event.account.walletClient
      ? { type: 'eoa', walletClient: event.account.walletClient }
      : undefined

    const isHcaRegistration =
      event.account.signer.type === 'rhinestone' &&
      ownerAddress.toLowerCase() !== event.account.accountAddress.toLowerCase()

    if (isHcaRegistration && !approvalSigner) {
      return enqueue.raise({
        type: '$error',
        error: new Error(
          'Cannot register: the wallet that owns this account is unavailable to sign the payment approval. Please reconnect your wallet and try again.',
        ),
      })
    }

    // The HCA reveal batch sets the ETH addr record itself and, when opted
    // in, the primary name through the reverse-registrar adapter, so the EOA
    // post-registration setup is skipped entirely on that path.
    const bundlePrimaryName =
      isHcaRegistration && event.postRegistrationSetup?.primaryName?.enabled
        ? asEthName(event.label)
        : undefined

    enqueue.assign({
      confirmedData: {
        label: event.label,
        duration: event.duration,
        ownerAddress,
        token: event.token,
        totalPrice: event.totalPrice,
        basePriceNumber: event.basePriceNumber,
        premiumPriceNumber: event.premiumPriceNumber,
      },
      postRegistrationSetup: isHcaRegistration
        ? undefined
        : event.postRegistrationSetup,
      postRegistrationData: {
        label: event.label,
        signer: event.account.signer,
        walletClient: event.account.walletClient,
        accountAddress: event.account.accountAddress,
        ownerAddress,
        publicClient: defaultPublicClient,
        chainId: defaultPublicClient.chain.id,
      },
      postRegistrationProgress: INITIAL_POST_REGISTRATION_PROGRESS,
      registrationCompleted: false,
      postRegistrationSetupFailed: false,
      ethRecordSyncTxId: undefined,
      primaryNameTxId: undefined,
      hcaPrimaryName: bundlePrimaryName,
      addrReverseClearTxId: undefined,
    })

    enqueue(
      machineSetup.sendTo(REGISTRATION_V2_ACTOR_ID, {
        type: 'START_REGISTRATION',
        name: asEthName(event.label),
        duration: event.duration,
        token: event.token,
        price: event.totalPrice,
        signer: event.account.signer,
        // Funding permit signer (wallet → HCA budget) on the HCA path.
        approvalSigner,
        accountAddress: event.account.accountAddress,
        ownerAddress,
        resolverOwnerAddress,
        publicClient: defaultPublicClient,
        // Standalone-HCA session-enable payload (omitted once enabled).
        hcaSessionEnable: event.hcaSessionEnable,
        primaryName: bundlePrimaryName,
      } satisfies RegistrationEvent),
    )
  }),
)

const submitPrimaryNameForwardAction = machineSetup.createAction(
  enqueueActions(({ enqueue, context }) => {
    if (!context.postRegistrationData?.walletClient) {
      return enqueue.raise({
        type: '$error',
        error: new Error('Post-registration data is incomplete'),
      })
    }

    try {
      // Sent by the owner EOA: the reverse registrars key on msg.sender.
      const txId = submitPrimaryNameForward({
        name: asEthName(context.postRegistrationData.label),
        signer: {
          type: 'eoa',
          walletClient: context.postRegistrationData.walletClient,
        },
        accountAddress: context.postRegistrationData.ownerAddress,
        publicClient: context.postRegistrationData.publicClient,
        chainId: context.postRegistrationData.chainId,
      })

      enqueue.assign({
        primaryNameTxId: txId,
      })
    } catch (error) {
      enqueue.raise({
        type: '$error',
        error: error instanceof Error ? error : new Error(String(error)),
      })
    }
  }),
)

const submitPrimaryNameReverseAction = machineSetup.createAction(
  enqueueActions(({ enqueue, context }) => {
    if (!context.postRegistrationData?.walletClient) {
      return enqueue.raise({
        type: '$error',
        error: new Error('Post-registration data is incomplete'),
      })
    }

    try {
      // Sent by the owner EOA: the reverse registrars key on msg.sender.
      const txId = submitPrimaryNameReverse({
        name: asEthName(context.postRegistrationData.label),
        signer: {
          type: 'eoa',
          walletClient: context.postRegistrationData.walletClient,
        },
        accountAddress: context.postRegistrationData.ownerAddress,
        publicClient: context.postRegistrationData.publicClient,
        chainId: context.postRegistrationData.chainId,
      })

      enqueue.assign({
        primaryNameTxId: txId,
      })
    } catch (error) {
      enqueue.raise({
        type: '$error',
        error: error instanceof Error ? error : new Error(String(error)),
      })
    }
  }),
)

export const registrationV2UiMachine = machineSetup.createMachine({
  id: 'registrationV2Ui',
  invoke: {
    id: REGISTRATION_V2_ACTOR_ID,
    src: 'registrationFlow',
    input: ({ context }) => ({
      chainId: context.chainId,
    }),
    onSnapshot: [
      {
        guard: ({ event: { snapshot } }) => snapshot.matches('success'),
        actions: ['captureChildSuccess'],
      },
      {
        guard: ({ event: { snapshot } }) => snapshot.matches('error'),
        actions: [
          raise(({ event: { snapshot } }) => ({
            type: 'transaction.failed',
            message: snapshot.context.error?.message,
          })),
        ],
      },
      {
        guard: ({ event: { snapshot } }) =>
          !snapshot.matches('success') && !snapshot.matches('error'),
        actions: 'updateRegistrationStageFromChild',
      },
    ],
  },
  initial: 'pricing',
  context: ({ input }) => ({
    chainId: input.chainId,
    duration: getDurationInSecondsFromYears(3),
    selectedToken: undefined,
    lastErrorMessage: undefined,
    postRegistrationProgress: INITIAL_POST_REGISTRATION_PROGRESS,
    registrationCompleted: false,
    postRegistrationSetupFailed: false,
    maxProgressReached: undefined,
  }),
  states: {
    pricing: {
      initial: 'duration',
      states: {
        duration: {
          on: {
            'pricing.duration.set': {
              actions: 'setDuration',
            },
            'pricing.step.next': {
              guard: 'isDurationValid',
              target: 'tokens',
            },
          },
        },
        tokens: {
          on: {
            'pricing.step.previous': {
              target: 'duration',
            },
            'pricing.token.select': {
              actions: 'setToken',
            },
            'pricing.dialog.dismiss': {
              target: 'duration',
            },
            'registration.start': {
              target: '#registrationV2Ui.registering',
              guard: ({ event }) =>
                event.duration >= MIN_REGISTER_DURATION_SECONDS,
              actions: [
                'clearError',
                'clearMaxProgress',
                startRegistrationAction,
              ],
            },
          },
        },
      },
    },
    registering: {
      type: 'parallel',
      states: {
        transaction: {
          initial: 'pendingRegistration',
          states: {
            pendingRegistration: {
              on: {
                'registration.completed': {
                  target: 'postRegistrationDecision',
                },
                'transaction.success': {
                  target: 'success',
                  actions: ['setRegistrationSuccessStage'],
                },
                'transaction.failed': {
                  target: '#registrationV2Ui.failure',
                  actions: ['setError'],
                },
              },
            },
            postRegistrationDecision: {
              entry: ['setPostRegistrationDecisionStage'],
              always: [
                {
                  guard: 'hasEthRecordSyncRemaining',
                  target: 'syncingEthRecord',
                },
                {
                  guard: 'hasPrimaryNameForwardRemaining',
                  target: 'settingPrimaryNameForward',
                },
                {
                  guard: 'hasPrimaryNameReverseRemaining',
                  target: 'settingPrimaryNameReverse',
                },
                {
                  guard: 'hasAddrReverseClearRemaining',
                  target: 'clearingStaleAddrReverse',
                },
                {
                  guard: 'primaryNameSetupUnavailable',
                  target: 'success',
                  actions: [
                    'setRegistrationSuccessStage',
                    'markPostRegistrationSetupFailed',
                  ],
                },
                {
                  target: 'success',
                  actions: ['setRegistrationSuccessStage'],
                },
              ],
            },
            syncingEthRecord: {
              entry: ['setSyncEthRecordStage'],
              invoke: {
                src: 'submitEthRecordTransaction',
                input: ({ context }) => {
                  if (!context.postRegistrationData?.resolverAddress) {
                    throw new Error(
                      'Post-registration setup cannot start without registration data',
                    )
                  }

                  return {
                    ...context.postRegistrationData,
                    resolverAddress:
                      context.postRegistrationData.resolverAddress,
                  }
                },
                onDone: {
                  target: 'waitingForEthRecordSync',
                  actions: ['storeEthRecordSyncTxId'],
                },
                onError: {
                  target: 'success',
                  actions: [
                    'setRegistrationSuccessStage',
                    'logPostRegistrationSetupError',
                    'markPostRegistrationSetupFailed',
                  ],
                },
              },
            },
            waitingForEthRecordSync: {
              entry: ['setWaitEthRecordStage'],
              invoke: {
                src: 'waitForKnownTransaction',
                input: ({ context }) => {
                  if (!context.ethRecordSyncTxId) {
                    throw new Error('ETH record sync transaction is missing')
                  }
                  return { txId: context.ethRecordSyncTxId }
                },
                onDone: {
                  target: 'postRegistrationDecision',
                  actions: ['markEthRecordSynced'],
                },
                onError: {
                  target: 'success',
                  actions: [
                    'setRegistrationSuccessStage',
                    'logPostRegistrationSetupError',
                    'markPostRegistrationSetupFailed',
                  ],
                },
              },
            },
            clearingStaleAddrReverse: {
              entry: ['setPrimaryNameStage'],
              invoke: {
                src: 'submitAddrReverseClear',
                input: ({ context }) => {
                  const data = context.postRegistrationData
                  if (!data?.walletClient) {
                    throw new Error(
                      'Cannot clear addr.reverse without the owner wallet',
                    )
                  }

                  return {
                    ownerAddress: data.ownerAddress,
                    walletClient: data.walletClient,
                    publicClient: data.publicClient,
                    chainId: data.chainId,
                  }
                },
                // Mark attempted on both branches: the no-op case is a
                // completed cleanup, and re-entering the decision state
                // without it would loop.
                onDone: [
                  {
                    guard: 'addrReverseClearSubmitted',
                    target: 'waitingForAddrReverseClear',
                    actions: [
                      'storeAddrReverseClearTxId',
                      'markAddrReverseClearAttempted',
                    ],
                  },
                  {
                    target: 'postRegistrationDecision',
                    actions: ['markAddrReverseClearAttempted'],
                  },
                ],
                onError: {
                  target: 'success',
                  actions: [
                    'setRegistrationSuccessStage',
                    'logPostRegistrationSetupError',
                    'markPostRegistrationSetupFailed',
                  ],
                },
              },
            },
            waitingForAddrReverseClear: {
              entry: ['setPrimaryNameStage'],
              invoke: {
                src: 'waitForKnownTransaction',
                input: ({ context }) => {
                  if (!context.addrReverseClearTxId) {
                    throw new Error('addr.reverse clear transaction is missing')
                  }
                  return { txId: context.addrReverseClearTxId }
                },
                onDone: {
                  target: 'postRegistrationDecision',
                },
                onError: {
                  target: 'success',
                  actions: [
                    'setRegistrationSuccessStage',
                    'logPostRegistrationSetupError',
                    'markPostRegistrationSetupFailed',
                  ],
                },
              },
            },
            settingPrimaryNameForward: {
              entry: ['setPrimaryNameStage', submitPrimaryNameForwardAction],
              always: {
                guard: 'hasPrimaryNameTxId',
                target: 'waitingForPrimaryNameForward',
              },
            },
            waitingForPrimaryNameForward: {
              entry: ['setPrimaryNameStage'],
              invoke: {
                src: 'waitForKnownTransaction',
                input: ({ context }) => {
                  if (!context.primaryNameTxId) {
                    throw new Error(
                      'Primary name forward transaction is missing',
                    )
                  }
                  return { txId: context.primaryNameTxId }
                },
                onDone: {
                  target: 'postRegistrationDecision',
                  actions: ['markPrimaryNameForwardConfirmed'],
                },
                onError: {
                  target: 'success',
                  actions: [
                    'setRegistrationSuccessStage',
                    'logPostRegistrationSetupError',
                    'markPostRegistrationSetupFailed',
                  ],
                },
              },
            },
            settingPrimaryNameReverse: {
              entry: ['setPrimaryNameStage', submitPrimaryNameReverseAction],
              always: {
                guard: 'hasPrimaryNameTxId',
                target: 'waitingForPrimaryNameReverse',
              },
            },
            waitingForPrimaryNameReverse: {
              entry: ['setPrimaryNameStage'],
              invoke: {
                src: 'waitForKnownTransaction',
                input: ({ context }) => {
                  if (!context.primaryNameTxId) {
                    throw new Error(
                      'Primary name reverse transaction is missing',
                    )
                  }
                  return { txId: context.primaryNameTxId }
                },
                onDone: {
                  target: 'success',
                  actions: ['setRegistrationSuccessStage'],
                },
                onError: {
                  target: 'success',
                  actions: [
                    'setRegistrationSuccessStage',
                    'logPostRegistrationSetupError',
                    'markPostRegistrationSetupFailed',
                  ],
                },
              },
            },
            success: {
              type: 'final',
            },
          },
        },
        notifications: {
          initial: 'settings',
          states: {
            settings: {
              on: {
                'notifications.step.next': {
                  target: 'completed',
                },
              },
            },
            completed: {
              type: 'final',
            },
          },
        },
      },
      onDone: {
        target: 'success',
        actions: ['invalidateNameQueries'],
      },
    },
    success: {},
    failure: {
      on: {
        retry: {
          target: 'registering',
          actions: ['clearError', 'forwardRetry'],
        },
        cancel: {
          target: 'pricing',
          actions: ['clearRegistrationData', 'clearError', 'forwardCancel'],
        },
      },
    },
  },
  on: {
    $error: {
      target: '.failure',
      actions: ['setError'],
    },
    'label.changed': {
      target: '.pricing',
      actions: ['clearRegistrationData', 'clearError', 'forwardCancel'],
    },
  },
})

export type RegistrationV2UiActor = ActorRefFrom<typeof registrationV2UiMachine>

export const getRegistrationV2ChildActor = (
  snapshot: SnapshotFrom<typeof registrationV2UiMachine>,
) =>
  snapshot.children[REGISTRATION_V2_ACTOR_ID] as
    | ActorRefFrom<typeof registrationMachine>
    | undefined
