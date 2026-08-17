/**
 * Reusable smart-session gate for any "start an HCA flow" action
 * (register, renew, …).
 *
 * On the HCA (rhinestone) path, session flows run prompt-free via a smart
 * session. Enabling that session is a PREREQUISITE for the whole flow, so this
 * gate prompts for it BEFORE the action proceeds — never mid-flow over another
 * modal. The EOA path has no session, so the action runs immediately.
 *
 * Usage:
 *   const { gate, sessionModal } = useSmartSessionGate()
 *   <Button onClick={() => gate(openTokenPicker)} />
 *   {sessionModal}
 *
 * `gate(onProceed)`: if a session is needed, opens the EnableSessionModal and
 * defers `onProceed` until the single ENABLE signature succeeds; otherwise runs
 * `onProceed` immediately.
 */

import { useCallback, useRef, useState } from 'react'
import { useSmartAccountContext } from '@/lib/smart-account/SmartAccountContext'
import { needsSessionBeforeRegistration } from '@/lib/smart-account/sessionGate'
import { EnableSessionModal } from '../components/EnableSessionModal'

export interface SmartSessionGate {
  /**
   * Run `onProceed`, gating on an active smart session first. If none is
   * active, the EnableSessionModal opens and `onProceed` runs only after the
   * ENABLE signature succeeds.
   */
  readonly gate: (onProceed: () => void) => void
  /** The wired EnableSessionModal element — render it in your tree. */
  readonly sessionModal: React.ReactNode
}

export function useSmartSessionGate(): SmartSessionGate {
  const account = useSmartAccountContext()
  const [isOpen, setIsOpen] = useState(false)
  const pendingRef = useRef<(() => void) | null>(null)

  const gate = useCallback(
    (onProceed: () => void) => {
      if (needsSessionBeforeRegistration(account)) {
        pendingRef.current = onProceed
        setIsOpen(true)
        return
      }
      onProceed()
    },
    [account],
  )

  const onEnableSession = useCallback(async () => {
    // The single ENABLE signature. On success, close the modal and run the
    // deferred action — the session is now active, so the downstream flow runs
    // prompt-free off `account.signer`.
    const signer = await account.enableSession()
    if (!signer) return // modal stays open, surfaces account.sessionError
    setIsOpen(false)
    const pending = pendingRef.current
    pendingRef.current = null
    pending?.()
  }, [account])

  const sessionModal = (
    <EnableSessionModal
      hasError={!!account.sessionError}
      isEnabling={account.isEnablingSession}
      onEnableSession={onEnableSession}
      onOpenChange={setIsOpen}
      open={isOpen}
      smartAccountAddress={account.accountAddress ?? undefined}
      walletAddress={account.ownerAddress ?? undefined}
    />
  )

  return { gate, sessionModal }
}
