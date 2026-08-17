import { logger } from '@ens-apps/utils/logger'
import { errAsync, type ResultAsync } from 'neverthrow'
import { type Hash, isAddressEqual, UserRejectedRequestError } from 'viem'
import {
  SignerAddressMismatchError,
  TransactionSubmissionError,
  TransactionUserRejectedError,
} from '../errors/transaction.errors'
import { safeSendTransaction } from '../helpers/viem-neverthrow.helpers'
import type { EOASigner } from '../types/signer.types'
import type {
  EOATransactionRequest,
  TransactionRequest,
} from '../types/transaction.types'

/**
 * EOA Transport Actor
 *
 * Submits standard EOA (Externally Owned Account) transactions via WalletClient.
 * This is a pure actor function with no state - all inputs are explicit parameters.
 */
export function submitEOATransaction(input: {
  request: TransactionRequest
  signer: EOASigner
}): ResultAsync<
  Hash,
  | TransactionSubmissionError
  | TransactionUserRejectedError
  | SignerAddressMismatchError
> {
  const { request, signer } = input
  const { walletClient } = signer
  const eoaRequest = request as EOATransactionRequest

  // Verify the request's declared `from` matches the account the wallet will
  // actually sign with. Viem signs for whatever `account` we pass, so a
  // divergence would sign with one key while attributing the tx to another —
  // fail closed before the wallet is ever prompted.
  const walletAddress = walletClient.account?.address
  if (!walletAddress || !isAddressEqual(walletAddress, eoaRequest.from)) {
    logger.error('EOA transaction from/account mismatch', {
      from: eoaRequest.from,
      walletAccount: walletAddress,
    })
    return errAsync(
      new SignerAddressMismatchError(eoaRequest.from, walletAddress),
    )
  }

  // Build transaction params - either legacy (gasPrice) or EIP-1559 (maxFeePerGas)
  // biome-ignore lint/suspicious/noExplicitAny: txParams is built dynamically with conditional gas fields, not expressible as a single static type
  const txParams: any = {
    account: eoaRequest.from,
    to: eoaRequest.to,
    value: eoaRequest.value,
    data: eoaRequest.data,
    gas: eoaRequest.gas,
    nonce: eoaRequest.nonce,
    chain: walletClient.chain ?? null,
  }

  // Use either legacy or EIP-1559 gas pricing (not both)
  if (eoaRequest.maxFeePerGas !== undefined) {
    txParams.maxFeePerGas = eoaRequest.maxFeePerGas
    txParams.maxPriorityFeePerGas = eoaRequest.maxPriorityFeePerGas
  } else if (eoaRequest.gasPrice !== undefined) {
    txParams.gasPrice = eoaRequest.gasPrice
  }

  return safeSendTransaction(walletClient, txParams).mapErr((error) => {
    if (
      error.name === 'TransactionExecutionError' &&
      error.cause instanceof UserRejectedRequestError
    ) {
      return new TransactionUserRejectedError(eoaRequest, error.cause)
    }

    logger.error('EOA transaction submission failed', error)
    return new TransactionSubmissionError(eoaRequest, error)
  })
}
