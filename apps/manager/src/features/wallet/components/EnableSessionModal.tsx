'use client'

import { Trans } from '@lingui/react/macro'
import { BrainCircuit, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type EnableSessionModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onEnableSession: () => Promise<void>
  walletAddress?: string
  smartAccountAddress?: string
  /** True while the ENABLE signature is in flight. */
  isEnabling?: boolean
  /** True when session enablement errored. */
  hasError?: boolean
}

export const EnableSessionModal = ({
  open,
  onOpenChange: _onOpenChange,
  onEnableSession,
  walletAddress: _walletAddress,
  smartAccountAddress,
  isEnabling = false,
  hasError = false,
}: EnableSessionModalProps) => {
  const status: 'idle' | 'signing' | 'error' = (() => {
    if (isEnabling) return 'signing'
    if (hasError) return 'error'
    return 'idle'
  })()

  const formatAddress = (address?: string) => {
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const handleEnable = async () => {
    if (status === 'signing') return
    try {
      await onEnableSession()
    } catch (error) {
      console.error('Failed to enable session:', error)
    }
  }

  const handleClose = () => {
    // Session is required — modal cannot be dismissed.
  }

  return (
    <Dialog onOpenChange={handleClose} open={open}>
      <DialogContent
        className="max-w-md border-ens-gray-two p-6"
        onInteractOutside={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle asChild>
            <h2 className="font-medium text-ens-blue-midnight text-xl tracking-tight">
              <Trans>Enable Smart Sessions</Trans>
            </h2>
          </DialogTitle>
          <DialogDescription className="sr-only">
            <Trans>
              Sign once to enable gasless transactions for your ENS operations.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ens-blue/10">
            {status === 'signing' ? (
              <Loader2 className="animate-spin text-ens-blue" size={32} />
            ) : (
              <BrainCircuit className="text-ens-blue" size={32} />
            )}
          </div>

          {smartAccountAddress && (
            <div className="flex flex-col items-center gap-1">
              <p className="text-ens-gray text-xs">
                <Trans>Smart Account</Trans>
              </p>
              <p className="font-mono text-ens-blue-midnight text-sm">
                {formatAddress(smartAccountAddress)}
              </p>
            </div>
          )}

          <div className="text-center">
            {status === 'error' ? (
              <div className="flex flex-col gap-2">
                <p className="font-medium text-ens-blue-midnight">
                  <Trans>Smart sessions are required to use this app.</Trans>
                </p>
                <p className="text-ens-gray text-sm">
                  <Trans>
                    It looks like the session setup didn&apos;t complete. Please
                    try again — without it, you won&apos;t be able to register
                    or manage names.
                  </Trans>
                </p>
              </div>
            ) : status === 'signing' ? (
              <>
                <p className="text-ens-blue-midnight">
                  <Trans>Enabling sessions…</Trans>
                </p>
                <p className="mt-2 text-ens-gray text-sm">
                  <Trans>
                    Approve the signature in your wallet, then wait for on-chain
                    confirmation.
                  </Trans>
                </p>
              </>
            ) : (
              <>
                <p className="text-ens-blue-midnight">
                  <Trans>Sign once to enable seamless transactions.</Trans>
                </p>
                <p className="mt-2 text-ens-gray text-sm">
                  <Trans>
                    After signing, your ENS operations (registrations, renewals,
                    etc.) won&apos;t require additional wallet signatures.
                  </Trans>
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            className={cn(
              'h-11 w-full rounded bg-ens-blue font-medium font-mono text-sm text-white uppercase tracking-wider',
              'hover:bg-ens-blue-hover',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
            disabled={status === 'signing'}
            onClick={handleEnable}
            type="button"
          >
            {status === 'signing' ? (
              <Trans>Enabling sessions…</Trans>
            ) : status === 'error' ? (
              <Trans>Try Again</Trans>
            ) : (
              <Trans>Enable Sessions</Trans>
            )}
          </Button>
        </div>

        {status === 'idle' && (
          <div className="flex flex-col items-center gap-1">
            <p className="text-center text-ens-gray text-xs">
              <Trans>
                This signature is free and doesn&apos;t cost any gas.
              </Trans>
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
