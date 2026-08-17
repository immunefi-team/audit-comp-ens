import { transactionManager } from '@ens-apps/transaction-manager'
import { useSelector } from '@xstate/react'
import { match, P } from 'ts-pattern'
import type { RegisteringTxSnapshot, TransactionState } from './txStageMessages'

const getRegistrationTxHash = (tx: RegisteringTxSnapshot) =>
  match(tx.value)
    .with('syncingEthRecord', () => tx.ethRecordSyncTxId)
    .with('waitingForResolverDeployment', () => tx.resolverTxId)
    .with('waitingForCommitment', () => tx.commitmentTxId)
    .with('waitingForApproval', () => tx.approvalTxId)
    .with('waitingForRegistration', () => tx.registrationTxId)
    .with('submittingRhinestoneBundle', () => tx.registrationTxId)
    .with('waitingForRhinestoneBundle', () => tx.registrationTxId)
    .with('waitingForEthRecordSync', () => tx.ethRecordSyncTxId)
    .with('settingPrimaryName', () => tx.primaryNameTxId)
    .otherwise(() => undefined)

export const useRegistrationTxState = (
  registeringTx: RegisteringTxSnapshot,
): TransactionState => {
  const txHash = getRegistrationTxHash(registeringTx)
  const txMachine = txHash
    ? transactionManager.getTransaction(txHash)
    : undefined

  return useSelector(txMachine, (s) =>
    match(s?.value)
      .with(P.string, (value) => value)
      .with({ error: P.any }, () => 'error' as const)
      .with(undefined, () => undefined)
      .exhaustive(),
  )
}
