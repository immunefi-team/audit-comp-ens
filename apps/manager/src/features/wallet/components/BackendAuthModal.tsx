import { Trans } from '@lingui/react/macro'
import { useMutation } from '@tanstack/react-query'
import { useSelector } from '@xstate/store-react'
import { useState } from 'react'
import { useConnection, useWalletClient } from 'wagmi'
import * as AlertDialog from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { signInBackendMutation } from '@/features/notifications/data/queries/auth'
import { useSmartAccountContextSafe } from '@/lib/smart-account/SmartAccountContext'
import { backendAuthStore } from '@/utils/backend-client'

export const BackendAuthModal = () => {
  const [modalStep, setModalStep] = useState<
    'verification' | 'skip-confirmation'
  >('verification')

  const isNotAuthedOrDismissed = useSelector(
    backendAuthStore,
    (state) => !state.context.authKey && state.context.modalDismissed === false,
  )
  const signIn = useMutation(signInBackendMutation)

  const { isConnected: isWalletConnected } = useConnection()
  const { data: walletClient } = useWalletClient()

  // Hold this modal until the SCA is live. Hook is null before the
  // provider mounts; then we don't wait, so EOA-only isn't stuck.
  const smartAccount = useSmartAccountContextSafe()
  const isSmartAccountReady =
    smartAccount === null || smartAccount.isAccountReady || !!smartAccount.error
  const shouldShowModal =
    isWalletConnected && isNotAuthedOrDismissed && isSmartAccountReady

  const handleSignIn = async () => {
    if (!walletClient) {
      throw new Error('No wallet client found')
    }

    try {
      await signIn.mutateAsync({ walletClient })
    } catch (error) {
      console.error('Failed to sign in:', error)
    }
  }

  const handleSkip = () => {
    setModalStep('skip-confirmation')
  }

  const handleConfirmSkip = () => {
    backendAuthStore.trigger.dismissModal()
    setModalStep('verification')
  }

  const handleGoBack = () => {
    setModalStep('verification')
  }

  return (
    <AlertDialog.Root
      onOpenChange={(open) => {
        if (!open) {
          if (modalStep === 'verification') {
            handleSkip()
          } else {
            handleConfirmSkip()
          }
        }
      }}
      open={shouldShowModal}
    >
      <AlertDialog.Content>
        {modalStep === 'verification' ? (
          <>
            <AlertDialog.Header>
              <AlertDialog.Title>
                <Trans>Verify your wallet</Trans>
              </AlertDialog.Title>
              <AlertDialog.Description>
                <Trans>
                  Sign in with your wallet to enable backend features, including
                  notifications about your ENS domains, transfers, expiry
                  reminders, and important updates.
                </Trans>
              </AlertDialog.Description>
            </AlertDialog.Header>
            <div className="space-y-4">
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
              {!walletClient && (
                <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3">
                  <p className="text-destructive text-sm">
                    <Trans>
                      Wallet client missing, please reconnect your wallet and
                      try again.
                    </Trans>
                  </p>
                </div>
              )}
            </div>
            <AlertDialog.Footer>
              <AlertDialog.Cancel onClick={handleSkip}>
                <Trans>Skip for now</Trans>
              </AlertDialog.Cancel>
            </AlertDialog.Footer>
          </>
        ) : (
          <>
            <AlertDialog.Header>
              <AlertDialog.Title>
                <Trans>Are you sure?</Trans>
              </AlertDialog.Title>
              <AlertDialog.Description>
                <Trans>
                  Skipping SIWE verification means you won't get notifications
                  about your domains or be able to save favorites while
                  browsing.
                </Trans>
              </AlertDialog.Description>
            </AlertDialog.Header>

            <div className="space-y-3">
              <div className="rounded-lg border border-ens-lapis-dust/50 bg-ens-lapis-dust/20 p-4">
                <h4 className="mb-2 font-medium text-ens-lapis-dense text-sm">
                  <Trans>You'll miss:</Trans>
                </h4>
                <ul className="space-y-1 text-ens-gray text-sm">
                  <li>
                    <Trans>Domain transfer & expiry notifications</Trans>
                  </li>
                  <li>
                    <Trans>Saved favorites & searches</Trans>
                  </li>
                  <li>
                    <Trans>And more...</Trans>
                  </li>
                </ul>
              </div>

              <div className="rounded-lg bg-ens-peridot-dust/30 p-3">
                <p className="text-ens-peridot-text-medium text-xs">
                  <Trans>
                    You can verify later by clicking your profile in the navbar
                  </Trans>
                </p>
              </div>
            </div>

            <AlertDialog.Footer>
              <Button onClick={handleGoBack} variant="outline">
                <Trans>Go Back</Trans>
              </Button>
              <Button onClick={handleConfirmSkip} variant="destructive">
                <Trans>Skip Anyway</Trans>
              </Button>
            </AlertDialog.Footer>
          </>
        )}
      </AlertDialog.Content>
    </AlertDialog.Root>
  )
}
