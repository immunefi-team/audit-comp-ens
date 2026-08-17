import type { CustomTransactionIntent } from '@ens-apps/transaction-manager'
import {
  type Signer,
  transactionManager,
  waitForTransaction,
} from '@ens-apps/transaction-manager'
import {
  deleteAliasWriteParameters,
  setAliasWriteParameters,
} from '@ensdomains/ensjs/wallet/v2'
import {
  type Address,
  encodeFunctionData,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem'
import { toEoaCustomIntent } from '@/features/transaction-manager/helpers/intents'

export interface SetAliasTransactionParameters {
  readonly fromName: string
  readonly toName: string
  readonly resolverAddress: Address
  readonly walletClient: WalletClient
  readonly chainId: number
}

/** The setAlias intent, shared by the gas estimate and `setAlias`. */
export const prepareSetAliasTransaction = ({
  fromName,
  toName,
  resolverAddress,
  walletClient,
  chainId,
}: SetAliasTransactionParameters): CustomTransactionIntent => {
  if (!walletClient.account || !walletClient.chain) {
    throw new Error('Wallet client must have account and chain configured')
  }

  const client = walletClient as Parameters<typeof setAliasWriteParameters>[0]

  const writeParams = setAliasWriteParameters(client, {
    fromName,
    toName,
    resolverAddress,
  })

  const data = encodeFunctionData({
    abi: writeParams.abi,
    functionName: writeParams.functionName,
    args: writeParams.args,
  } as Parameters<typeof encodeFunctionData>[0])

  return toEoaCustomIntent({
    from: walletClient.account.address,
    to: resolverAddress,
    data,
    chainId,
  })
}

export interface SetAliasParameters extends SetAliasTransactionParameters {
  readonly publicClient: PublicClient
  readonly signer: Signer
  readonly id: string
}

export interface SetAliasResult {
  readonly txId: string
  readonly hash: Hex
}

export const setAlias = async (
  params: SetAliasParameters,
): Promise<SetAliasResult> => {
  const {
    fromName,
    toName,
    resolverAddress,
    walletClient,
    publicClient,
    signer,
    chainId,
    id,
  } = params

  const txId = transactionManager.startTransaction(
    prepareSetAliasTransaction({
      fromName,
      toName,
      resolverAddress,
      walletClient,
      chainId,
    }),
    signer,
    {
      id,
      description: `Set alias ${fromName} → ${toName}`,
      publicClient,
      chainId,
    },
  )

  const result = await waitForTransaction(txId)

  return {
    txId,
    hash: result.hash,
  }
}

export interface DeleteAliasTransactionParameters {
  readonly fromName: string
  readonly resolverAddress: Address
  readonly walletClient: WalletClient
  readonly chainId: number
}

/** The deleteAlias intent, shared by the gas estimate and `deleteAlias`. */
export const prepareDeleteAliasTransaction = ({
  fromName,
  resolverAddress,
  walletClient,
  chainId,
}: DeleteAliasTransactionParameters): CustomTransactionIntent => {
  if (!walletClient.account || !walletClient.chain) {
    throw new Error('Wallet client must have account and chain configured')
  }

  const client = walletClient as Parameters<
    typeof deleteAliasWriteParameters
  >[0]

  const writeParams = deleteAliasWriteParameters(client, {
    fromName,
    resolverAddress,
  })

  const data = encodeFunctionData({
    abi: writeParams.abi,
    functionName: writeParams.functionName,
    args: writeParams.args,
  } as Parameters<typeof encodeFunctionData>[0])

  return toEoaCustomIntent({
    from: walletClient.account.address,
    to: resolverAddress,
    data,
    chainId,
  })
}

export interface DeleteAliasParameters
  extends DeleteAliasTransactionParameters {
  readonly publicClient: PublicClient
  readonly signer: Signer
  readonly id: string
}

export const deleteAlias = async (
  params: DeleteAliasParameters,
): Promise<SetAliasResult> => {
  const {
    fromName,
    resolverAddress,
    walletClient,
    publicClient,
    signer,
    chainId,
    id,
  } = params

  const txId = transactionManager.startTransaction(
    prepareDeleteAliasTransaction({
      fromName,
      resolverAddress,
      walletClient,
      chainId,
    }),
    signer,
    {
      id,
      description: `Delete alias ${fromName}`,
      publicClient,
      chainId,
    },
  )

  const result = await waitForTransaction(txId)

  return {
    txId,
    hash: result.hash,
  }
}
