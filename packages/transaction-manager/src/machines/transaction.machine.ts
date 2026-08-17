import { logger } from '@ens-apps/utils/logger'
import { fromResultAsync } from '@ens-apps/utils/xstate/neverthrow'
import { errAsync, fromPromise, ResultAsync } from 'neverthrow'
import type { Hash, PublicClient, TransactionReceipt } from 'viem'
import { TransactionReceiptNotFoundError } from 'viem'
import { assign, fromPromise as fromPromiseXState, setup } from 'xstate'
import { submitEOATransaction } from '../actors/eoa-transport.actor'
import { prepareTransaction } from '../actors/prepare-transaction.actor'
import { submitWarpTransaction } from '../actors/warp-transport.actor'
import {
  EthCallFallbackError,
  SignerAddressMismatchError,
  TransactionRevertedError,
  TransactionSubmissionError,
  TransactionTimeoutError,
  TransactionUserRejectedError,
} from '../errors/transaction.errors'
import type { Signer } from '../types/signer.types'
import type {
  EOATransactionRequest,
  TransactionIntent,
  TransactionModalState,
  TransactionOptions,
  TransactionRequest,
} from '../types/transaction.types'

/**
 * Base Transaction Machine
 *
 * Generic transaction lifecycle machine that routes to different transport actors
 * based on signer type:
 * - EOA: Standard wallet transactions via submitEOATransaction
 * - Rhinestone: Intent-based submission via submitWarpTransaction (Warp
 *   orchestrator, the only supported smart-account infrastructure)
 *
 * This machine focuses solely on transaction lifecycle (prepare → submit →
 * pending → confirm).
 */
export const transactionMachine = setup({
  types: {
    context: {} as {
      publicClient: PublicClient
      signer?: Signer
      intent?: TransactionIntent
      request?: TransactionRequest
      options: TransactionOptions
      chainId?: number
      useSmartAccount: boolean
      estimatedCost?: bigint
      hash?: Hash
      receipt?: TransactionReceipt
      error?: Error
      retryCount: number
      fallbackChecks: number
      modal: TransactionModalState
    },
    input: {} as {
      publicClient: PublicClient
      signer?: Signer
      intent?: TransactionIntent
      request?: TransactionRequest
      options?: TransactionOptions
      chainId?: number
      useSmartAccount?: boolean
    },
    events: {} as
      | {
          type: 'EXECUTE'
          request: TransactionRequest
          options?: TransactionOptions
          modal?: Partial<TransactionModalState>
        }
      | { type: 'RETRY' }
      | { type: 'CANCEL' }
      | { type: 'FORCE_SUCCESS' }
      | { type: 'OPEN_MODAL'; data?: Partial<TransactionModalState> }
      | { type: 'CLOSE_MODAL' }
      | { type: 'UPDATE_MODAL_DATA'; data: Partial<TransactionModalState> },
  },
  actors: {
    /**
     * Prepare Transaction Actor
     *
     * Routes to the appropriate preparation logic based on intent.type:
     * - ens-renewal / eth-transfer / custom
     */
    prepareTransaction: fromResultAsync(
      ({
        intent,
        publicClient,
        chainId,
        useSmartAccount,
      }: {
        intent: TransactionIntent
        publicClient: PublicClient
        chainId: number
        useSmartAccount: boolean
      }) =>
        prepareTransaction({
          intent,
          publicClient,
          chainId,
          useSmartAccount,
        }),
    ),

    /**
     * Submit Transaction Actor
     *
     * Routes to the appropriate transport actor based on signer type:
     * - eoa → submitEOATransaction
     * - rhinestone → submitWarpTransaction (Warp orchestrator, the only
     *   supported smart-account infrastructure)
     */
    submitTransaction: fromResultAsync(
      ({
        request,
        signer,
      }: {
        request?: TransactionRequest
        signer?: Signer
        options?: TransactionOptions
        publicClient: PublicClient
      }): ResultAsync<
        Hash,
        | TransactionSubmissionError
        | TransactionUserRejectedError
        | SignerAddressMismatchError
      > => {
        if (!request) {
          return errAsync(
            new TransactionSubmissionError(
              {} as TransactionRequest,
              new Error('No transaction request provided'),
            ),
          )
        }

        if (!signer) {
          return errAsync(
            new TransactionSubmissionError(
              request,
              new Error('No signer provided'),
            ),
          )
        }

        // Route to transport actor based on signer type + infrastructure
        switch (signer.type) {
          case 'eoa':
            return submitEOATransaction({ request, signer })

          case 'rhinestone':
            // Rhinestone HCA operations always route through the Warp
            // orchestrator (intent-based, user-paid).
            return submitWarpTransaction({ request, signer })

          default:
            signer satisfies never
            return errAsync(
              new TransactionSubmissionError(
                request,
                new Error(
                  `Unknown signer type: ${(signer as { type?: string }).type || 'unknown'}`,
                ),
              ),
            )
        }
      },
    ),

    /**
     * Wait for Transaction Receipt
     */
    waitForReceipt: fromResultAsync(
      ({
        hash,
        options,
        publicClient,
      }: {
        hash: Hash
        options?: TransactionOptions
        publicClient: PublicClient
      }): ResultAsync<TransactionReceipt, TransactionTimeoutError> => {
        const confirmations = options?.confirmations || 1
        const timeout = options?.timeout || 120000

        return fromPromise(
          publicClient.waitForTransactionReceipt({
            hash,
            confirmations,
            timeout,
          }),
          (_error) => new TransactionTimeoutError(hash, timeout),
        )
      },
    ),

    /**
     * Check transaction with receipt fallback
     *
     * Attempts to fetch the transaction receipt to determine if the transaction
     * has been confirmed. This avoids the false-positive issue with eth_call
     * simulation, where stateless transactions (e.g. ERC20 approve) simulate
     * successfully even before being mined — causing dependent transactions to
     * start prematurely.
     */
    checkWithEthCall: fromResultAsync(
      ({
        hash,
        request,
        publicClient,
      }: {
        hash?: Hash
        request?: TransactionRequest
        publicClient: PublicClient
      }): ResultAsync<
        { wouldSucceed: boolean; result?: Hash; receipt?: TransactionReceipt },
        EthCallFallbackError
      > => {
        if (!request) {
          return errAsync(
            new EthCallFallbackError(
              {} as TransactionRequest,
              new Error('No request provided'),
            ),
          )
        }

        // If we have a hash, check if the transaction has actually been confirmed
        // on-chain rather than simulating it. This prevents false positives where
        // a transaction simulates successfully (e.g. ERC20 approve) but hasn't
        // been mined yet, which would cause dependent transactions to fail.
        if (hash) {
          return fromPromise(
            publicClient
              .getTransactionReceipt({ hash })
              .then((receipt) => ({
                wouldSucceed: receipt.status === 'success',
                result: hash,
                receipt,
              }))
              .catch((error: unknown) => {
                // A missing receipt just means the tx isn't mined yet — not
                // confirmed, keep polling. Any other error is real and must
                // propagate (wrapped as EthCallFallbackError) rather than be
                // masked as a generic "would not succeed".
                if (error instanceof TransactionReceiptNotFoundError) {
                  return { wouldSucceed: false as const }
                }
                throw error
              }),
            (error) => new EthCallFallbackError(request, error),
          )
        }

        if (request.type === 'rhinestone-intent') {
          // Rhinestone intents simulate via the orchestrator; skip the
          // eth_call fallback path entirely.
          return ResultAsync.fromSafePromise(
            Promise.resolve({ wouldSucceed: true }),
          )
        }

        const eoaRequest = request as EOATransactionRequest

        return fromPromise(
          (async () => {
            const result = await publicClient.call({
              account: eoaRequest.from,
              to: eoaRequest.to,
              data: eoaRequest.data,
              value: eoaRequest.value,
              gas: eoaRequest.gas,
            })
            return {
              wouldSucceed: !result.data?.includes('0x08c379a0'), // Check for revert
              result: result.data,
            }
          })(),
          (error) => new EthCallFallbackError(request, error),
        )
      },
    ),

    /**
     * Wait utility actor
     */
    wait: fromPromiseXState(
      ({ input }: { input: number }) =>
        new Promise((resolve) => setTimeout(resolve, input)),
    ),
  },
  guards: {
    shouldCheckFallback: ({ context }) => context.fallbackChecks < 3,

    wouldSucceed: (_, params: { wouldSucceed?: boolean }) =>
      params.wouldSucceed === true,

    isReverted: ({ context }) => context.receipt?.status === 'reverted',
  },
}).createMachine({
  id: 'transaction',
  initial: 'idle',
  context: ({ input }) => {
    // Extract request from custom intent if applicable
    const request =
      input.request ||
      (input.intent?.type === 'custom' ? input.intent.request : undefined)

    return {
      // biome-ignore lint/style/noNonNullAssertion: value guaranteed by machine state
      publicClient: input.publicClient!,
      signer: input.signer,
      intent: input.intent,
      request,
      options: input.options || {},
      chainId: input.chainId,
      useSmartAccount: input.useSmartAccount || false,
      retryCount: 0,
      fallbackChecks: 0,
      modal: {
        isOpen: false,
        flowType: 'single',
        currentStepIndex: 0,
        ...(input.options?.modal || {}),
      },
    }
  },
  on: {
    CLOSE_MODAL: {
      actions: assign({
        modal: ({ context }) => ({
          ...context.modal,
          isOpen: false,
        }),
      }),
    },
    UPDATE_MODAL_DATA: {
      actions: assign({
        modal: ({ event, context }) => ({
          ...context.modal,
          ...event.data,
        }),
      }),
    },
  },
  states: {
    idle: {
      always: [
        {
          // If we have an intent, prepare the transaction first
          guard: ({ context }) =>
            !!context.intent && !!context.publicClient && !!context.chainId,
          target: 'preparing',
        },
        {
          // If we have a pre-prepared request, skip to submitting
          guard: ({ context }) => !!context.request && !!context.publicClient,
          target: 'submitting',
        },
      ],
      on: {
        EXECUTE: {
          target: 'submitting',
          actions: assign({
            request: ({ event }) => event.request,
            options: ({ event }) => event.options || {},
            retryCount: 0,
            fallbackChecks: 0,
            hash: undefined,
            receipt: undefined,
            error: undefined,
            modal: ({ event, context }) => ({
              ...context.modal,
              ...(event.modal || {}),
              isOpen: true,
            }),
          }),
        },
        OPEN_MODAL: {
          actions: assign({
            modal: ({ event, context }) => ({
              ...context.modal,
              ...(event.data || {}),
              isOpen: true,
            }),
          }),
        },
      },
    },

    preparing: {
      invoke: {
        src: 'prepareTransaction',
        input: ({ context }) => ({
          // biome-ignore lint/style/noNonNullAssertion: value guaranteed by machine state
          intent: context.intent!,
          publicClient: context.publicClient,
          // biome-ignore lint/style/noNonNullAssertion: value guaranteed by machine state
          chainId: context.chainId!,
          useSmartAccount: context.useSmartAccount,
        }),
        onDone: {
          target: 'submitting',
          actions: assign({
            request: ({ event }) => event.output.request,
            estimatedCost: ({ event }) => event.output.estimatedCost,
          }),
        },
        onError: {
          target: 'error.preparation',
          actions: [
            assign({
              error: ({ event }) => event.error as Error,
            }),
            ({ event }) =>
              logger.error('Transaction preparation failed', event.error),
          ],
        },
      },
      on: {
        CANCEL: 'error.cancelled',
      },
    },

    submitting: {
      invoke: {
        src: 'submitTransaction',
        input: ({ context }) => ({
          request: context.request,
          signer: context.signer,
          options: context.options,
          publicClient: context.publicClient,
        }),
        onDone: {
          target: 'pending',
          actions: assign({
            hash: ({ event }) => event.output,
          }),
        },
        onError: [
          {
            /** Can retry? */
            guard: ({ context, event }) => {
              // Don't retry if the transaction was rejected by the user
              if (event.error instanceof TransactionUserRejectedError) {
                return false
              }

              // A signer/address mismatch is non-recoverable: the same
              // signer + request pair fails the same check every time and the
              // wallet is never even prompted. Surface it immediately instead
              // of burning retries.
              if (event.error instanceof SignerAddressMismatchError) {
                return false
              }

              // "Nonce too low" means the wallet's local nonce cache is
              // desynced from the chain (or another tx already consumed the
              // same nonce). Re-submitting with the same params will hit the
              // same error — bail out and surface it to the user.
              const message =
                event.error instanceof Error ? event.error.message : ''
              if (
                /nonce too low|nonce.*lower than/i.test(message) ||
                /NonceTooLowError/.test(message)
              ) {
                return false
              }

              // Retry up to the retry count
              return context.retryCount < (context.options.retryCount ?? 3)
            },
            target: 'retrying',
            actions: assign({
              error: ({ event }) => event.error as Error,
              retryCount: ({ context }) => context.retryCount + 1,
            }),
          },
          {
            target: 'error.submission',
            actions: [
              assign({
                error: ({ event }) => event.error as Error,
              }),
              ({ event }) =>
                logger.error('Transaction submission failed', event.error),
            ],
          },
        ],
      },
    },

    pending: {
      invoke: {
        src: 'waitForReceipt',
        input: ({ context }) => ({
          // biome-ignore lint/style/noNonNullAssertion: value guaranteed by machine state
          hash: context.hash!,
          options: context.options,
          publicClient: context.publicClient,
        }),
        onDone: {
          target: 'confirming',
          actions: assign({
            receipt: ({ event }) => event.output,
          }),
        },
        onError: [
          {
            guard: 'shouldCheckFallback',
            target: 'checkingFallback',
            actions: assign({
              fallbackChecks: ({ context }) => context.fallbackChecks + 1,
            }),
          },
          {
            target: 'error.timeout',
            actions: [
              assign({
                error: ({ event }) => event.error as Error,
              }),
              ({ event }) => logger.error('Transaction timed out', event.error),
            ],
          },
        ],
      },
      on: {
        FORCE_SUCCESS: {
          target: 'success',
        },
      },
    },

    checkingFallback: {
      invoke: {
        src: 'checkWithEthCall',
        input: ({ context }) => ({
          hash: context.hash,
          request: context.request,
          publicClient: context.publicClient,
        }),
        onDone: [
          {
            guard: ({ event }) => event.output.wouldSucceed,
            target: 'success',
            actions: assign({
              receipt: ({ event }) => event.output.receipt,
            }),
          },
          {
            target: 'pending',
          },
        ],
        onError: {
          // Real fallback-check failures (network, RPC) shouldn't fail the
          // transaction — return to pending and retry — but they must be
          // visible rather than silently swallowed.
          target: 'pending',
          actions: ({ event }) =>
            logger.warn(
              'eth_call fallback check failed; retrying',
              event.error,
            ),
        },
      },
    },

    confirming: {
      always: [
        {
          guard: 'isReverted',
          target: 'error.reverted',
          actions: [
            assign({
              error: ({ context }) =>
                new TransactionRevertedError(
                  `Transaction ${context.hash} reverted`,
                ),
            }),
            ({ context }) =>
              logger.error('Transaction reverted', { hash: context.hash }),
          ],
        },
        {
          target: 'success',
        },
      ],
    },

    retrying: {
      invoke: {
        src: 'wait',
        input: ({ context }) => context.options.retryDelay ?? 2000,
        onDone: {
          target: 'submitting',
        },
      },
      on: {
        CANCEL: {
          target: 'error.cancelled',
        },
      },
    },

    success: {
      on: {
        EXECUTE: {
          target: 'submitting',
          actions: assign({
            request: ({ event }) => event.request,
            options: ({ event }) => event.options || {},
            retryCount: 0,
            fallbackChecks: 0,
            hash: undefined,
            receipt: undefined,
            error: undefined,
          }),
        },
      },
    },

    error: {
      initial: 'unknown',
      states: {
        preparation: {},
        validation: {},
        submission: {},
        timeout: {},
        reverted: {},
        cancelled: {},
        unknown: {},
      },
      on: {
        RETRY: {
          target: 'submitting',
          actions: assign({
            retryCount: ({ context }) => context.retryCount + 1,
            error: undefined,
          }),
        },
        EXECUTE: {
          target: 'submitting',
          actions: assign({
            request: ({ event }) => event.request,
            options: ({ event }) => event.options || {},
            retryCount: 0,
            fallbackChecks: 0,
            hash: undefined,
            receipt: undefined,
            error: undefined,
          }),
        },
      },
    },
  },
})
