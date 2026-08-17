import { Trans, useLingui } from '@lingui/react/macro'
import { useMutation } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useAtom } from '@xstate/store-react'
import { CheckCircle, Mail, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import * as v from 'valibot'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { verifyEmailMutationOptions } from '@/features/notifications/data/queries/channels'
import { isBackendAuthed } from '@/utils/backend-client'

// Shared card wrapper component
function VerificationCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <Card>{children}</Card>
      </div>
    </div>
  )
}

// Shared card header component
function VerificationHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <CardHeader className="text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
        {icon}
      </div>
      <CardTitle className="mt-4">{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
  )
}

export const Route = createFileRoute('/notifications/channels/email/verify')({
  component: EmailVerificationPage,
  validateSearch: v.object({
    token: v.optional(v.string()),
  }),
  loaderDeps: ({ search: { token } }) => ({
    token,
  }),
})

function EmailVerificationPage() {
  const { token } = Route.useLoaderDeps()
  const navigate = useNavigate()
  const isAuthed = useAtom(isBackendAuthed)
  const { t } = useLingui()

  const verifyEmailMutation = useMutation(verifyEmailMutationOptions)

  const continueTo = isAuthed ? '/notifications/settings' : '/'
  const continueLabel = isAuthed ? t`Continue to Settings` : t`Continue to Home`

  const handleContinue = () => {
    navigate({ to: continueTo })
  }

  const handleVerify = (verificationToken?: string) => {
    const tokenToUse = verificationToken || token
    if (!tokenToUse) return

    verifyEmailMutation.mutate(tokenToUse, {
      onSuccess: () => {
        toast.success(t`Email verified successfully`)
        setTimeout(() => {
          navigate({ to: continueTo })
        }, 1200)
      },
      onError: () => {
        toast.error(t`Failed to verify email`)
      },
    })
  }

  // If no token, show manual code entry using the shared component
  if (!token) {
    return (
      <VerificationCard>
        <VerificationHeader
          description={t`Open the verification link from your email to finish setup.`}
          icon={<Mail className="h-6 w-6 text-gray-400" />}
          title={t`Check Your Email`}
        />
        <CardContent className="space-y-4">
          <p className="text-center text-muted-foreground text-sm">
            <Trans>
              This page can only verify your email when opened from the link in
              the verification email.
            </Trans>
          </p>
          <Button
            className="w-full text-sm leading-ens-none"
            onClick={handleContinue}
            size="lg"
            variant="outline"
          >
            {continueLabel}
          </Button>
        </CardContent>
      </VerificationCard>
    )
  }

  // Determine current state
  const isPending = verifyEmailMutation?.status === 'pending'
  const isSuccess = verifyEmailMutation?.status === 'success'
  const isError = verifyEmailMutation?.status === 'error'

  // Get appropriate icon, title, and description
  const icon = isPending ? (
    <Mail className="h-6 w-6 animate-pulse text-gray-400" />
  ) : isSuccess ? (
    <CheckCircle className="h-6 w-6 text-green-600" />
  ) : isError ? (
    <XCircle className="h-6 w-6 text-red-600" />
  ) : (
    <Mail className="h-6 w-6 text-gray-400" />
  )

  const title = isPending
    ? t`Verifying Email...`
    : isSuccess
      ? t`Email Verified!`
      : isError
        ? t`Verification Failed`
        : t`Verify Your Email`

  const description = isPending
    ? t`Please wait while we verify your email address.`
    : isSuccess
      ? t`You can now receive notifications at this email address.`
      : isError
        ? t`There was a problem verifying your email address.`
        : t`Click the button below to verify your email address and start receiving notifications.`

  return (
    <VerificationCard>
      <VerificationHeader description={description} icon={icon} title={title} />
      <CardContent className="space-y-4">
        {/* Error message */}
        {isError && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              {verifyEmailMutation.error?.message ||
                t`An error occurred during verification`}
            </AlertDescription>
          </Alert>
        )}

        {/* Success message */}
        {isSuccess && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <Trans>Your email has been verified successfully!</Trans>
            </AlertDescription>
          </Alert>
        )}

        {/* Loading spinner */}
        {isPending && (
          <div className="py-4 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-current border-r-transparent border-solid motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          </div>
        )}

        {/* Action buttons */}
        {isError ? (
          <div className="space-y-2">
            <Button
              className="w-full text-sm leading-ens-none"
              onClick={() => handleVerify()}
              size="lg"
              variant="blue"
            >
              <Trans>Try Again</Trans>
            </Button>
            <Button
              className="w-full text-sm leading-ens-none"
              onClick={handleContinue}
              size="lg"
              variant="outline"
            >
              {continueLabel}
            </Button>
          </div>
        ) : isSuccess ? (
          <Button
            className="w-full text-sm leading-ens-none"
            onClick={handleContinue}
            size="lg"
            variant="lightBlue"
          >
            {continueLabel}
          </Button>
        ) : (
          <div className="space-y-2">
            <Button
              className="w-full text-sm leading-ens-none"
              onClick={() => handleVerify()}
              size="lg"
              variant="blue"
            >
              <Trans>Verify Email Address</Trans>
            </Button>
            <Button
              asChild
              className="w-full text-sm leading-ens-none"
              size="lg"
              variant="outline"
            >
              {isAuthed ? (
                <Link to="/notifications/settings">
                  <Trans>Back to Settings</Trans>
                </Link>
              ) : (
                <Link to="/">
                  <Trans>Back to Home</Trans>
                </Link>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </VerificationCard>
  )
}
