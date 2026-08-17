import type { Signer } from '@ens-apps/transaction-manager'
import type { SUPPORTED_TOKEN } from '@ens-apps/transaction-manager/contracts/ens-sepolia'
import {
  pollTransactionStatusActor,
  readPaymentTokenAllowanceActor,
  submitApprovalActor,
  submitRenewActor,
} from '@ens-apps/transaction-manager/machines/registration/registration.actors'
import { $qk, qk } from '@ens-apps/utils/tanstack-query/queryKey'
import { fromResultAsync } from '@ens-apps/utils/xstate/neverthrow'
import type { Address } from 'viem'
import { assign, setup } from 'xstate'
import { getDurationInSecondsFromYears } from '@/features/register-v2/utils/time'
import { getV1RenewableQueryOptions } from '@/features/renew/data/queries/v1Renewable.query'
import {
  getRenewerAddress,
  type RenewalProtocol,
} from '@/features/renew/utils/renewalProtocol'
import { publicClient } from '@/lib/wagmi'
import { getQueryClient } from '@/utils/router/root-context'

// Renewal is not an HCA flow: allowance check, approve and renew all run as
// plain wallet transactions against the selected canonical renewer.

type SubmissionData = {
  label: string
  duration: bigint
  token: SUPPORTED_TOKEN
  /** Price in token units */
  priceRaw: bigint

  /** Formatted base price */
  priceNumber: number

  /**
   * Renewal uses the DIRECT WALLET route: the connected EOA approves + renews
   * with plain wagmi transactions (the scoped HCA session does not permit
   * renewal). This is always an EOA signer.
   */
  signer: Signer

  /**
   * EOA that pays the rent. `ETHRegistrar.renew` charges `_msgSender()` — the
   * connected wallet on the direct route — so the allowance is read for and
   * authorized by this EOA.
   */
  ownerAddress: Address
}

const requireSubmissionData = (
  submissionData: SubmissionData | undefined,
): SubmissionData => {
  if (!submissionData) throw new Error('Renewal submission data is required')
  return submissionData
}

export const renewalUiMachine = setup({
  types: {
    context: {} as {
      currentExpiry: bigint
      protocol: RenewalProtocol
      renewerAddress: Address
      duration: bigint
      selectedToken: SUPPORTED_TOKEN | undefined
      lastErrorMessage?: string
      submissionData?: SubmissionData
      approvalTxId?: string
      renewalTxId?: string
    },
    input: {} as {
      currentExpiry: bigint
      protocol: RenewalProtocol
    },
    events: {} as
      | { type: 'pricing.step.next' }
      | { type: 'pricing.step.previous' }
      | { type: 'pricing.dialog.dismiss' }
      | { type: 'pricing.duration.set'; duration: bigint }
      | { type: 'pricing.token.select'; token: SUPPORTED_TOKEN | undefined }
      | {
          type: 'renewal.start'
          label: string
          duration: bigint
          token: SUPPORTED_TOKEN
          /** Price in token units */
          priceRaw: bigint
          signer: Signer
          ownerAddress: Address

          /** Formatted base price */
          priceNumber: number
        }
      | { type: 'retry' }
      | { type: 'cancel' }
      | { type: 'label.changed' },
    tags: '' as 'renewing',
  },
  actors: {
    readPaymentTokenAllowance: fromResultAsync(
      (input: Parameters<typeof readPaymentTokenAllowanceActor>[0]) =>
        readPaymentTokenAllowanceActor(input),
    ),
    submitTokenApproval: fromResultAsync(
      (input: Parameters<typeof submitApprovalActor>[0]) =>
        submitApprovalActor(input),
    ),
    submitRenewal: fromResultAsync(
      (input: Parameters<typeof submitRenewActor>[0]) =>
        submitRenewActor(input),
    ),
    pollTransactionStatus: fromResultAsync((input: { txId: string }) => {
      return pollTransactionStatusActor(input)
    }),
  },
  guards: {
    // The registrar already has enough allowance from the paying EOA, so no
    // approval is needed — go straight to renew.
    hasSufficientAllowance: ({ context }, params: { allowance: bigint }) =>
      !!context.submissionData &&
      params.allowance >= context.submissionData.priceRaw,
  },
  actions: {
    setDuration: assign({
      duration: ({ event, context }) =>
        event.type === 'pricing.duration.set'
          ? event.duration
          : context.duration,
    }),
    setToken: assign({
      selectedToken: ({ event, context }) =>
        event.type === 'pricing.token.select'
          ? event.token
          : context.selectedToken,
    }),
    clearFailure: assign({
      lastErrorMessage: () => undefined,
    }),
    clearSubmission: assign({
      submissionData: () => undefined,
      approvalTxId: () => undefined,
      renewalTxId: () => undefined,
      lastErrorMessage: () => undefined,
    }),
    startRenewal: assign({
      lastErrorMessage: () => undefined,
      approvalTxId: () => undefined,
      renewalTxId: () => undefined,
      submissionData: ({ event }) =>
        event.type === 'renewal.start'
          ? {
              label: event.label,
              duration: event.duration,
              signer: event.signer,
              token: event.token,
              priceRaw: event.priceRaw,
              priceNumber: event.priceNumber,
              ownerAddress: event.ownerAddress,
            }
          : undefined,
    }),
    invalidateNameQueries: ({ context }) => {
      const name = context.submissionData?.label
      const queryClient = getQueryClient()
      if (!name || !queryClient) {
        return
      }

      queryClient.invalidateQueries({
        queryKey: $qk({
          name: `${name}.eth`,
        }),
      })

      if (context.protocol === 'v1') {
        queryClient.invalidateQueries({
          queryKey: getV1RenewableQueryOptions(`${name}.eth`).queryKey,
        })
        queryClient.invalidateQueries({
          queryKey: qk('migration', 'v1_names'),
        })
      }
    },
  },
}).createMachine({
  id: 'renewalUi',
  context: ({ input }) => ({
    currentExpiry: input.currentExpiry,
    protocol: input.protocol,
    renewerAddress: getRenewerAddress(input.protocol),
    duration: BigInt(
      getDurationInSecondsFromYears(
        1,
        new Date(Number(input.currentExpiry) * 1000),
      ),
    ),
    selectedToken: undefined,
    lastErrorMessage: undefined,
  }),
  initial: 'pricing',
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
            'pricing.step.next': {
              guard: ({ context }) => context.selectedToken !== undefined,
              target: 'confirm',
            },
            'pricing.dialog.dismiss': {
              target: 'duration',
            },
          },
        },
        confirm: {
          on: {
            'pricing.step.previous': {
              target: 'tokens',
            },
            'pricing.dialog.dismiss': {
              target: 'duration',
            },
            'renewal.start': {
              target: '#renewalUi.checkingAllowance',
              actions: 'startRenewal',
            },
          },
        },
      },
    },
    // Read the connected EOA's current allowance to the registrar. Renewal is
    // the DIRECT WALLET route: the EOA is `_msgSender()` and pays the rent.
    checkingAllowance: {
      tags: 'renewing',
      invoke: {
        src: 'readPaymentTokenAllowance',
        input: ({ context }) => {
          const submission = requireSubmissionData(context.submissionData)
          return {
            owner: submission.ownerAddress,
            selectedToken: submission.token,
            publicClient,
            registrarAddress: context.renewerAddress,
          }
        },
        onDone: [
          {
            // Already authorized enough — skip approval entirely.
            guard: {
              type: 'hasSufficientAllowance',
              params: ({ event }) => ({ allowance: event.output }),
            },
            target: 'submittingRenewal',
          },
          // Set the allowance with a plain on-chain approve (EOA pays gas).
          { target: 'submittingTokenApproval' },
        ],
        // If the read fails, fall back to authorizing rather than blocking.
        onError: { target: 'submittingTokenApproval' },
      },
    },
    submittingTokenApproval: {
      tags: 'renewing',
      invoke: {
        id: 'submitTokenApproval',
        src: 'submitTokenApproval',
        input: ({ context }) => {
          const submission = requireSubmissionData(context.submissionData)
          return {
            tokenPrice: submission.priceRaw,
            selectedToken: submission.token,
            // Direct wallet route — the connected EOA signs the approve.
            signer: submission.signer,
            publicClient,
            registrarAddress: context.renewerAddress,
          }
        },
        onDone: {
          target: 'waitingForTokenApproval',
          actions: assign({
            approvalTxId: ({ event }) => event.output,
          }),
        },
        onError: {
          target: 'failure',
          actions: assign({
            lastErrorMessage: ({ event }) =>
              event.error instanceof Error
                ? event.error.message
                : 'Token approval failed',
          }),
        },
      },
    },
    waitingForTokenApproval: {
      tags: 'renewing',
      invoke: {
        src: 'pollTransactionStatus',
        input: ({ context }) => {
          if (!context.approvalTxId) {
            throw new Error('approvalTxId is required')
          }
          return { txId: context.approvalTxId }
        },
        onDone: {
          target: 'submittingRenewal',
        },
        onError: {
          target: 'failure',
          actions: assign({
            lastErrorMessage: ({ event }) =>
              event.error instanceof Error
                ? event.error.message
                : 'Token approval polling failed',
          }),
        },
      },
    },
    // Direct wallet route: a plain on-chain `renew` from the EOA (allowance is
    // already sufficient, or was just set by `submittingTokenApproval`).
    submittingRenewal: {
      tags: 'renewing',
      always: { target: 'submittingPlainRenewal' },
    },
    submittingPlainRenewal: {
      tags: 'renewing',
      invoke: {
        id: 'submitRenewal',
        src: 'submitRenewal',
        input: ({ context }) => {
          const submission = requireSubmissionData(context.submissionData)
          return {
            label: submission.label,
            duration: submission.duration,
            selectedToken: submission.token,
            signer: submission.signer,
            publicClient,
            renewerAddress: context.renewerAddress,
          }
        },
        onDone: {
          target: 'waitingForRenewal',
          actions: assign({
            renewalTxId: ({ event }) => event.output,
          }),
        },
        onError: {
          target: 'failure',
          actions: assign({
            lastErrorMessage: ({ event }) =>
              event.error instanceof Error
                ? event.error.message
                : 'Renewal failed',
          }),
        },
      },
    },
    waitingForRenewal: {
      tags: 'renewing',
      invoke: {
        src: 'pollTransactionStatus',
        input: ({ context }) => {
          if (!context.renewalTxId) {
            throw new Error('renewalTxId is required')
          }
          return { txId: context.renewalTxId }
        },
        onDone: {
          target: 'success',
          actions: ['invalidateNameQueries'],
        },
        onError: {
          target: 'failure',
          actions: assign({
            lastErrorMessage: ({ event }) =>
              event.error instanceof Error
                ? event.error.message
                : 'Renewal failed',
          }),
        },
      },
    },
    success: {},
    failure: {
      on: {
        // Retry from the allowance check: a prior attempt may have landed (skip
        // to renew) and a fresh permit signature is needed otherwise.
        retry: {
          target: 'checkingAllowance',
          actions: [
            'clearFailure',
            assign({
              approvalTxId: () => undefined,
              renewalTxId: () => undefined,
            }),
          ],
        },
        cancel: {
          target: 'pricing',
          actions: ['clearFailure', 'clearSubmission'],
        },
      },
    },
  },
  on: {
    'label.changed': {
      target: '.pricing',
      actions: ['clearFailure', 'clearSubmission'],
    },
  },
})
