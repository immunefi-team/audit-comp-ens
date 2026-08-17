import { Trans } from '@lingui/react/macro'
import { useMutation } from '@tanstack/react-query'
import { useAtom, useSelector } from '@xstate/store-react'
import type { ReactNode } from 'react'
import { useConnection, useWalletClient } from 'wagmi'
import { Button } from '@/components/ui/button'
import { signInBackendMutation } from '@/features/notifications/data/queries/auth'
import { useSmartAccountContext } from '@/lib/smart-account'
import { useConnectModal } from '@/lib/wallet'
import { backendAuthStore, isBackendAuthed } from '@/utils/backend-client'

interface RequireBackendAuthProps {
  children: ReactNode
}

export const RequireBackendAuth = ({ children }: RequireBackendAuthProps) => {
  const signIn = useMutation(signInBackendMutation)
  const isAuthed = useAtom(isBackendAuthed)
  const authAddress = useSelector(
    backendAuthStore,
    (state) => state.context.address,
  )
  const { data: walletClient } = useWalletClient()
  const { ownerAddress } = useSmartAccountContext()
  const { openConnectModal } = useConnectModal()

  const { status: connectionStatus } = useConnection()

  if (
    connectionStatus === 'connecting' ||
    connectionStatus === 'reconnecting'
  ) {
    return (
      <div className="mx-auto max-w-md px-4 py-6 text-center">
        <p className="text-muted-foreground text-sm">
          <Trans>Checking wallet connection...</Trans>
        </p>
      </div>
    )
  }

  // This should never happen, but just in case
  const isWrongWallet =
    !!authAddress &&
    !!ownerAddress &&
    authAddress.toLowerCase() !== ownerAddress.toLowerCase()

  if (isWrongWallet) {
    return (
      <div className="mx-auto max-w-md px-4 py-6">
        <div className="space-y-4 text-center">
          <h3 className="font-medium text-lg">
            <Trans>Wrong wallet connected</Trans>
          </h3>
          <p className="text-muted-foreground text-sm">
            <Trans>
              Reconnect the wallet used for notifications, then sign in again.
            </Trans>
          </p>
          {/* Show the two addresses */}
          <div className="flex flex-col gap-2">
            <div>
              <Trans>Auth address:</Trans> {authAddress}
            </div>
            <div>
              <Trans>Account address:</Trans> {ownerAddress}
            </div>
          </div>
          <Button
            className="w-full"
            onClick={() => openConnectModal?.()}
            size="lg"
          >
            <Trans>Reconnect Wallet</Trans>
          </Button>
        </div>
      </div>
    )
  }

  if (isAuthed) {
    return <>{children}</>
  }

  if (connectionStatus === 'disconnected') {
    return (
      <div className="mx-auto max-w-md px-4 py-6">
        <div className="space-y-4 text-center">
          <h3 className="font-medium text-lg">
            <Trans>Connect your wallet</Trans>
          </h3>
          <p className="text-muted-foreground text-sm">
            <Trans>
              Connect a wallet to continue to notification settings and
              activity.
            </Trans>
          </p>
          <Button
            className="w-full"
            onClick={() => openConnectModal?.()}
            size="lg"
          >
            <Trans>Connect Wallet</Trans>
          </Button>
        </div>
      </div>
    )
  }

  const handleSignIn = async () => {
    try {
      if (!walletClient) {
        throw new Error('No wallet client found')
      }

      await signIn.mutateAsync({ walletClient })
    } catch (error) {
      console.error('Failed to sign in:', error)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <div className="space-y-4 text-center">
        <div className="space-y-2">
          <h3 className="font-medium text-lg">
            <Trans>Verify wallet ownership</Trans>
          </h3>
          <p className="text-muted-foreground text-sm">
            <Trans>
              Sign in to access notifications about your ENS domains, including
              transfers, expiry reminders, and important updates.
            </Trans>
          </p>
        </div>

        <Button
          className="w-full"
          disabled={signIn.isPending || !walletClient}
          onClick={handleSignIn}
          size="lg"
        >
          {signIn.isPending ? (
            <Trans>Signing in...</Trans>
          ) : (
            <Trans>Sign in with Wallet</Trans>
          )}
        </Button>

        {signIn.isError && (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3">
            <p className="text-destructive text-sm">
              <Trans>Failed to sign in. Please try again.</Trans>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
