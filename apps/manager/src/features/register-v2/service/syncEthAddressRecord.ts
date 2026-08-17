import {
  getSmartAccountAddress,
  type Signer,
  type TransactionRequest,
  transactionManager,
  waitForTransaction,
} from '@ens-apps/transaction-manager'
import { setRecordsWriteParameters } from '@ensdomains/ensjs/wallet'
import {
  type Address,
  checksumAddress,
  encodeFunctionData,
  type PublicClient,
} from 'viem'

type SyncEthAddressRecordParams = {
  name: string
  ownerAddress: Address
  resolverAddress: Address
  signer: Signer
  accountAddress: Address
  publicClient: PublicClient
  chainId: number
  onTxId?: (txId: string) => void
}

const withEthSuffix = (name: string) =>
  name.endsWith('.eth') ? name : `${name}.eth`

export async function startSyncEthAddressRecordTransaction(
  params: SyncEthAddressRecordParams,
): Promise<string> {
  const {
    name,
    ownerAddress,
    resolverAddress,
    signer,
    accountAddress,
    publicClient,
    chainId,
    onTxId,
  } = params

  const cleanName = withEthSuffix(name)

  // Use ensjs to build the write parameters
  // publicClient is used only for chain metadata — ensjs doesn't send transactions here
  const client = publicClient as unknown as Parameters<
    typeof setRecordsWriteParameters
  >[0]

  const data = encodeFunctionData(
    (await setRecordsWriteParameters(client, {
      name: cleanName,
      resolverAddress,
      coins: [{ coin: 60, value: checksumAddress(ownerAddress) }],
    })) as Parameters<typeof encodeFunctionData>[0],
  )

  const from =
    signer.type === 'eoa' ? accountAddress : getSmartAccountAddress(signer)

  const request: TransactionRequest =
    signer.type === 'eoa'
      ? {
          type: 'eoa',
          from,
          to: resolverAddress,
          data,
          value: 0n,
          chainId,
        }
      : {
          type: 'rhinestone-intent',
          from,
          chainId,
          rhinestoneParams: {
            calls: [{ to: resolverAddress, data, value: 0n }],
            // User-paid in USDC out of the HCA's own balance — this deployment
            // has no gas sponsorship. NOTE: no funding leg here. The HCA route
            // no longer reaches this (the reveal batch writes the addr record
            // itself), but if it ever does, route the calls through
            // `planHcaIntentFunding` first.
            feeAsset: 'USDC',
          },
        }

  const txId = transactionManager.startTransaction(
    { type: 'custom', request },
    signer,
    {
      description: `Set ETH address record for ${cleanName}`,
      publicClient,
      chainId,
      operation: 'set-addr-record',
      name: cleanName,
    },
  )

  onTxId?.(txId)
  return txId
}

export async function syncEthAddressRecord(
  params: SyncEthAddressRecordParams,
): Promise<void> {
  const txId = await startSyncEthAddressRecordTransaction(params)
  await waitForTransaction(txId)
}
