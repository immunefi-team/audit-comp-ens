import { errAsync, okAsync, ResultAsync } from 'neverthrow'
import type { Hex, PublicClient } from 'viem'
import { prepareENSRenewalTransaction } from '../helpers/rhinestone-account.helpers'
import {
  getPrimaryCall,
  type TransactionIntent,
  type TransactionRequest,
} from '../types/transaction.types'

export class TransactionPreparationError extends Error {
  constructor(
    public intent: TransactionIntent,
    message: string,
    public cause?: Error,
  ) {
    super(message)
    this.name = 'TransactionPreparationError'
  }
}

export interface PreparedTransactionData {
  request: TransactionRequest
  estimatedCost: bigint
}

/**
 * Prepare Transaction Actor
 *
 * Routes to the appropriate preparation logic based on intent type.
 * Returns an unsigned transaction request ready for submission.
 */
export function prepareTransaction(input: {
  intent: TransactionIntent
  publicClient: PublicClient
  chainId: number
  useSmartAccount: boolean
}): ResultAsync<PreparedTransactionData, TransactionPreparationError> {
  const { intent, publicClient, chainId, useSmartAccount } = input

  // Route based on intent type
  switch (intent.type) {
    case 'ens-renewal':
      return prepareENSRenewal(intent, publicClient, chainId, useSmartAccount)

    case 'eth-transfer':
      return prepareETHTransfer(intent, publicClient, chainId, useSmartAccount)

    case 'custom':
      // Custom intent already has a prepared request. Derive the estimated cost
      // from the primary call so it works for both EOA (top-level value) and
      // Rhinestone intents (value lives in rhinestoneParams.calls).
      return ResultAsync.fromSafePromise(
        Promise.resolve({
          request: intent.request,
          estimatedCost: getPrimaryCall(intent.request)?.value ?? 0n,
        }),
      )

    default:
      return errAsync(
        new TransactionPreparationError(
          intent,
          `Unknown intent type: ${(intent as unknown as Record<string, unknown>).type}`,
        ),
      )
  }
}

/**
 * Prepare ENS Renewal Transaction
 */
function prepareENSRenewal(
  intent: Extract<TransactionIntent, { type: 'ens-renewal' }>,
  publicClient: PublicClient,
  chainId: number,
  useSmartAccount: boolean,
): ResultAsync<PreparedTransactionData, TransactionPreparationError> {
  const { name, duration, from } = intent

  // prepareENSRenewalTransaction already returns a ResultAsync, so chain it
  // directly rather than unwrapping-and-rethrowing (see package CLAUDE.md).
  return prepareENSRenewalTransaction(publicClient, { name, duration })
    .map(({ to, data, value }) => {
      // Create the appropriate request type based on account type
      const request: TransactionRequest = useSmartAccount
        ? {
            type: 'rhinestone-intent',
            from,
            chainId,
            rhinestoneParams: {
              calls: [
                {
                  to,
                  data,
                  value,
                },
              ],
            },
          }
        : {
            type: 'eoa',
            from,
            to,
            data,
            value,
            chainId,
          }

      return {
        request,
        estimatedCost: value, // For ENS renewal, the cost is just the renewal price (gas will be added during execution)
      }
    })
    .mapErr(
      (error) =>
        new TransactionPreparationError(
          intent,
          `Failed to prepare ENS renewal: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error instanceof Error ? error : undefined,
        ),
    )
}

/**
 * Prepare ETH Transfer Transaction
 */
function prepareETHTransfer(
  intent: Extract<TransactionIntent, { type: 'eth-transfer' }>,
  _publicClient: PublicClient,
  chainId: number,
  useSmartAccount: boolean,
): ResultAsync<PreparedTransactionData, TransactionPreparationError> {
  const { to, value, from, data } = intent

  // Pure request construction — no async work, so return okAsync rather than
  // wrapping sync code in a Promise (see package CLAUDE.md).
  const request: TransactionRequest = useSmartAccount
    ? {
        type: 'rhinestone-intent',
        from,
        chainId,
        rhinestoneParams: {
          calls: [
            {
              to,
              data: data || ('0x' as Hex),
              value,
            },
          ],
        },
      }
    : {
        type: 'eoa',
        from,
        to,
        data: data || ('0x' as Hex),
        value,
        chainId,
      }

  return okAsync({
    request,
    estimatedCost: value,
  })
}
