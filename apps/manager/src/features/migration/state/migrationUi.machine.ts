import type { Signer } from '@ens-apps/transaction-manager'
import type { RhinestoneAccount } from '@rhinestone/sdk'
import type { Config as WagmiConfig } from '@wagmi/core'
import type { Hex, PublicClient } from 'viem'
import { assign, fromCallback, type SnapshotFrom, setup } from 'xstate'
import {
  adjustPlanForRetry,
  type MigrationPlan,
} from '@/features/migration/service/buildMigrationPlan'
import {
  decodeMigrationError,
  type MigrationError,
} from '@/features/migration/service/decodeMigrationError'
import {
  executeMigration,
  type MigrationProgress,
  type MigrationResult,
  type MigrationStepDescriptor,
} from '@/features/migration/service/migrationService'
import { publicClient as defaultPublicClient } from '@/lib/wagmi'

const FAILURE_HOLD_MS = 1500

type Context = {
  wagmiConfig: WagmiConfig
  selectedNames: string[]
  plan?: MigrationPlan
  signer?: Signer
  hcaClient?: Pick<RhinestoneAccount, 'getAddress' | 'getInitData'>
  refreshAccount?: () => Promise<void>
  reconcileBeforeSubmit: boolean
  migratedNames: string[]
  txHashes: readonly Hex[]
  progress?: MigrationProgress
  stepDescriptors: readonly MigrationStepDescriptor[]
  lastError?: MigrationError
}

type Events =
  | { type: 'selection.set'; names: string[] }
  | {
      type: 'migration.start'
      plan: MigrationPlan
      signer: Signer
      hcaClient: Pick<RhinestoneAccount, 'getAddress' | 'getInitData'>
      refreshAccount: () => Promise<void>
    }
  | { type: 'migration.progress'; progress: MigrationProgress }
  | {
      type: 'migration.batchComplete'
      names: readonly string[]
      txHash?: Hex
    }
  | {
      type: 'migration.complete'
      result: MigrationResult
    }
  | { type: 'migration.failed'; error: MigrationError }
  | { type: 'retry' }
  | { type: 'done' }
  | { type: 'cancel' }

const initialContext = (wagmiConfig: WagmiConfig): Context => ({
  wagmiConfig,
  selectedNames: [],
  plan: undefined,
  reconcileBeforeSubmit: false,
  migratedNames: [],
  txHashes: [],
  progress: undefined,
  stepDescriptors: [],
  lastError: undefined,
})

export const migrationUiMachine = setup({
  types: {
    context: {} as Context,
    events: {} as Events,
    input: {} as { wagmiConfig: WagmiConfig },
    tags: '' as 'running' | 'result',
  },
  delays: {
    failureHold: FAILURE_HOLD_MS,
  },
  actors: {
    runMigration: fromCallback<
      Events,
      {
        wagmiConfig: WagmiConfig
        plan: MigrationPlan
        signer: Signer
        hcaClient: Pick<RhinestoneAccount, 'getAddress' | 'getInitData'>
        refreshAccount: () => Promise<void>
        reconcileBeforeSubmit: boolean
      }
    >(({ input, sendBack }) => {
      let cancelled = false

      const onProgress = (progress: MigrationProgress) => {
        if (cancelled) return
        sendBack({ type: 'migration.progress', progress })
      }

      const onBatchComplete = (names: readonly string[], txHash?: Hex) => {
        if (cancelled) return
        sendBack({ type: 'migration.batchComplete', names, txHash })
      }

      executeMigration({
        plan: input.plan,
        wagmiConfig: input.wagmiConfig,
        publicClient: defaultPublicClient as PublicClient,
        signer: input.signer,
        hcaClient: input.hcaClient,
        refreshAccount: input.refreshAccount,
        onProgress,
        onBatchComplete,
        reconcileBeforeSubmit: input.reconcileBeforeSubmit,
      })
        .then((result) => {
          if (cancelled) return
          sendBack({ type: 'migration.complete', result })
        })
        .catch((err: unknown) => {
          if (cancelled) return
          sendBack({
            type: 'migration.failed',
            error: decodeMigrationError(err),
          })
        })

      return () => {
        cancelled = true
      }
    }),
  },
  guards: {
    hasSelection: ({ event }) =>
      event.type === 'migration.start' && event.plan.classified.length > 0,
    isOnlyFailures: ({ event, context }) =>
      event.type === 'migration.complete' &&
      event.result.txHashes.length === 0 &&
      context.migratedNames.length === 0,
  },
  actions: {
    setSelection: assign({
      selectedNames: ({ event, context }) =>
        event.type === 'selection.set' ? event.names : context.selectedNames,
    }),
    captureMigrationStart: assign(({ event }) => {
      if (event.type !== 'migration.start') return {}
      return {
        plan: event.plan,
        signer: event.signer,
        hcaClient: event.hcaClient,
        refreshAccount: event.refreshAccount,
        reconcileBeforeSubmit: false,
        stepDescriptors: event.plan.stepDescriptors,
        progress: undefined,
        lastError: undefined,
        txHashes: [] as readonly Hex[],
      }
    }),
    setProgress: assign({
      progress: ({ event, context }) =>
        event.type === 'migration.progress' ? event.progress : context.progress,
    }),
    appendBatchComplete: assign(({ event, context }) => {
      if (event.type !== 'migration.batchComplete') return {}
      const existing = new Set(context.migratedNames)
      const nextNames = [...context.migratedNames]
      for (const name of event.names) {
        if (!existing.has(name)) {
          nextNames.push(name)
          existing.add(name)
        }
      }
      const nextHashes = event.txHash
        ? new Set(context.txHashes).has(event.txHash)
          ? context.txHashes
          : [...context.txHashes, event.txHash]
        : context.txHashes
      return {
        migratedNames: nextNames,
        txHashes: nextHashes,
      }
    }),
    recordCompletion: assign(({ event, context }) => {
      if (event.type !== 'migration.complete') return {}
      const existingHashes = new Set(context.txHashes)
      const mergedHashes = [
        ...context.txHashes,
        ...event.result.txHashes.filter((h) => !existingHashes.has(h)),
      ]
      return {
        txHashes: mergedHashes,
      }
    }),
    setError: assign({
      lastError: ({ event, context }) =>
        event.type === 'migration.failed' ? event.error : context.lastError,
    }),
    resetForRetry: assign(({ context }) => {
      if (!context.plan) return {}
      const nextPlan = adjustPlanForRetry(context.plan, context.migratedNames)
      const migratedSet = new Set(context.migratedNames)
      return {
        plan: nextPlan,
        stepDescriptors: nextPlan.stepDescriptors,
        selectedNames: context.selectedNames.filter((n) => !migratedSet.has(n)),
        reconcileBeforeSubmit: true,
        lastError: undefined,
        progress: undefined,
      }
    }),
    resetAll: assign(({ context }) => ({
      ...initialContext(context.wagmiConfig),
    })),
  },
}).createMachine({
  id: 'migrationUi',
  context: ({ input }) => initialContext(input.wagmiConfig),
  initial: 'select',
  on: {
    'migration.failed': {
      target: '.failure',
      actions: 'setError',
    },
  },
  states: {
    select: {
      on: {
        'selection.set': {
          actions: 'setSelection',
        },
        'migration.start': {
          target: 'migrate',
          guard: 'hasSelection',
          actions: 'captureMigrationStart',
        },
      },
    },
    migrate: {
      initial: 'running',
      states: {
        running: {
          tags: 'running',
          invoke: {
            id: 'runMigration',
            src: 'runMigration',
            input: ({ context }) => {
              if (
                !context.plan ||
                !context.signer ||
                !context.hcaClient ||
                !context.refreshAccount
              ) {
                throw new Error('Migration context is incomplete')
              }
              return {
                wagmiConfig: context.wagmiConfig,
                plan: context.plan,
                signer: context.signer,
                hcaClient: context.hcaClient,
                refreshAccount: context.refreshAccount,
                reconcileBeforeSubmit: context.reconcileBeforeSubmit,
              }
            },
          },
          on: {
            'migration.progress': {
              actions: 'setProgress',
            },
            'migration.batchComplete': {
              actions: 'appendBatchComplete',
            },
            'migration.complete': [
              {
                target: 'failing',
                guard: 'isOnlyFailures',
              },
              {
                target: '#migrationUi.success',
                actions: 'recordCompletion',
              },
            ],
            'migration.failed': {
              target: 'failing',
              actions: 'setError',
            },
          },
        },
        failing: {
          tags: 'running',
          after: {
            failureHold: { target: '#migrationUi.failure' },
          },
        },
      },
    },
    success: {
      tags: 'result',
      on: {
        done: {
          target: 'select',
          actions: 'resetAll',
        },
      },
    },
    failure: {
      tags: 'result',
      on: {
        retry: {
          target: 'migrate',
          actions: 'resetForRetry',
        },
        cancel: {
          target: 'select',
          actions: 'resetAll',
        },
      },
    },
  },
})

export type MigrationUiSnapshot = SnapshotFrom<typeof migrationUiMachine>
