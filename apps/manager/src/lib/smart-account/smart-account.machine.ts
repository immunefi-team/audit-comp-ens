import type { SmartAccountConfig } from '@ens-apps/transaction-manager'
import { fromResultAsync } from '@ens-apps/utils/xstate/neverthrow'
import type { Address, PublicClient, WalletClient } from 'viem'
import { assign, type StateFrom, setup } from 'xstate'
import type { TransactionInfra } from '@/utils/feature-flags'
import {
  type AccountClient,
  type AccountInitResult,
  initializeAccountActor,
} from './actors/initialize-account.actor'

export type WalletSource = 'external-wallet'

interface SmartAccountContext {
  readonly client: AccountClient | null
  readonly accountAddress: Address | null
  readonly ownerAddress: Address | null
  readonly config: SmartAccountConfig | null
  readonly walletSource: WalletSource | null
  readonly walletClient: WalletClient | null
  readonly publicClient: PublicClient | null
  readonly infrastructure: TransactionInfra
  readonly error: string | null
}

type WalletConnectedEvent = {
  type: 'WALLET_CONNECTED'
  walletSource: 'external-wallet'
  walletClient: WalletClient
  publicClient: PublicClient
}

type SmartAccountEvent =
  | WalletConnectedEvent
  | { type: 'WALLET_DISCONNECTED' }
  | { type: 'REFRESH' }

// The HCA is session-less; gas sponsorship always routes through the
// Rhinestone Warp orchestrator (intent-based, relayer-funded). Warp is the
// only supported infrastructure, so it is a constant rather than a
// per-wallet feature-flag decision.
const INITIAL_CONTEXT: SmartAccountContext = {
  client: null,
  accountAddress: null,
  ownerAddress: null,
  config: null,
  walletSource: null,
  walletClient: null,
  publicClient: null,
  infrastructure: 'warp',
  error: null,
}

function requireWalletSource(context: SmartAccountContext): WalletSource {
  if (!context.walletSource) {
    throw new Error('Wallet source is missing')
  }

  return context.walletSource
}

const logState = (state: string) =>
  ({ type: 'logTransition' as const, params: { state } }) as const

export const smartAccountMachine = setup({
  types: {
    context: {} as SmartAccountContext,
    events: {} as SmartAccountEvent,
  },
  actors: {
    initializeAccount: fromResultAsync(initializeAccountActor),
  },
  actions: {
    resetContext: assign(() => INITIAL_CONTEXT),
    logTransition: ({ context }, params: { state: string }) => {
      console.log(`🔧 [SmartAccount] Entering state: ${params.state}`, {
        accountAddress: context.accountAddress,
      })
    },
  },
}).createMachine({
  id: 'smartAccount',
  initial: 'disconnected',
  context: INITIAL_CONTEXT,

  states: {
    disconnected: {
      entry: ['resetContext', logState('disconnected')],
      on: {
        WALLET_CONNECTED: {
          target: 'initializing',
          actions: assign(({ event }) => ({
            walletSource: event.walletSource,
            walletClient: event.walletClient ?? null,
            publicClient: event.publicClient ?? null,
            error: null,
          })),
        },
      },
    },

    initializing: {
      entry: [logState('initializing')],
      invoke: {
        src: 'initializeAccount',
        input: ({ context }) => ({
          walletSource: requireWalletSource(context),
          walletClient: context.walletClient ?? undefined,
          publicClient: context.publicClient ?? undefined,
        }),
        onDone: {
          target: 'ready',
          actions: assign(({ event }) => {
            const output = event.output as AccountInitResult
            return {
              client: output.client,
              accountAddress: output.address,
              ownerAddress: output.ownerAddress,
              config: output.config,
              error: null,
            }
          }),
        },
        onError: {
          target: 'error',
          actions: assign({
            error: ({ event }) =>
              event.error instanceof Error
                ? event.error.message
                : String(event.error),
          }),
        },
      },
    },

    ready: {
      entry: [logState('ready')],
      on: {
        REFRESH: 'initializing',
        WALLET_DISCONNECTED: 'disconnected',
      },
    },

    error: {
      entry: [logState('error')],
      on: {
        REFRESH: 'initializing',
        WALLET_DISCONNECTED: 'disconnected',
      },
    },
  },
})

export const selectIsLoading = (state: StateFrom<typeof smartAccountMachine>) =>
  state.value === 'initializing'

export const selectIsReady = (state: StateFrom<typeof smartAccountMachine>) =>
  state.value === 'ready'
