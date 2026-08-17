import { transactionManager } from '@ens-apps/transaction-manager'
import { FastForward } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ExtendNameModal } from '@/features/renew/components/ExtendNameModal'
import { useCanExtend } from '@/features/renew/hooks/useCanExtend'
import { useRenewalTransactions } from '@/features/renew/hooks/useRenewalTransactions'
import { TransactionModal } from '@/features/transaction-manager/components/TransactionModal'
import {
  isTransactionInFlight,
  useActiveTransactionState,
} from '@/features/transaction-manager/hooks/useActiveTransactionState'
import { useTransactionModal } from '@/features/transaction-manager/hooks/useTransactionModal'
import type { ProtocolVersion } from '@/utils/types'

type ExtendNameButtonProps = {
  name: string
  protocolVersion: ProtocolVersion
}

/**
 * Extend/renew entry point on the name page. v1 and v2 names share the same
 * ERC-20 renewal flow (approve + `renew(label,duration,token,referrer)`); they
 * differ only in the renewer contract (v2 `ETHRegistrar` vs `ETHRenewerV1` for
 * unmigrated v1 names) and where the current expiry is read from. The renewer is
 * resolved from `isV2` inside the flow.
 */
export const ExtendNameButton = ({
  name,
  protocolVersion,
}: ExtendNameButtonProps) => {
  const [open, setOpen] = useState(false)

  const { canExtend, selectedName } = useCanExtend({ name, protocolVersion })

  const { transactions, startFlow, clearIncompatibleRenewalState } =
    useRenewalTransactions({
      onComplete: () => {
        setOpen(false)
      },
    })

  const activeTxState = useActiveTransactionState()
  const { isOpen: isTransactionModalOpen, openModal } = useTransactionModal()

  if (!canExtend) return null

  return (
    <>
      <Button
        variant="default"
        onClick={() => {
          if (isTransactionInFlight(activeTxState)) {
            openModal()
            return
          }
          // Stale terminal-state transactions (success/error) block the modal;
          // remove only that entry so a fresh extend flow can start without
          // touching any other in-flight transactions in the manager.
          if (activeTxState) {
            transactionManager.cancelTransaction(activeTxState.txId)
          }
          clearIncompatibleRenewalState('single')
          setOpen(true)
        }}
      >
        <FastForward className="size-4" />
        Extend
      </Button>
      <ExtendNameModal
        open={open && !isTransactionModalOpen}
        onClose={() => {
          setOpen(false)
        }}
        selectedName={selectedName}
        onExtend={(config) => {
          startFlow(selectedName, config)
          openModal()
        }}
      />
      <TransactionModal transactions={transactions} />
    </>
  )
}
