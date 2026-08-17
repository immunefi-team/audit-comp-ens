import { $qk } from '@ens-apps/utils/tanstack-query/queryKey'
import { Trans, useLingui } from '@lingui/react/macro'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle, Mail, XCircle } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { channelQueryOptions } from '@/features/notifications/data/queries/channels'

interface EmailVerifyStepProps {
  channelId: string
  isVerifying: boolean
  isVerified: boolean
  verificationError: string | null
  onVerifyCode: (token: string) => void
  onBackToSend: () => void
  onCancel: () => void
  onSuccess: () => void
}

export const EmailVerifyStep = ({
  channelId,
  isVerifying,
  isVerified,
  verificationError,
  onVerifyCode,
  onBackToSend,
  onCancel,
  onSuccess,
}: EmailVerifyStepProps) => {
  const { t } = useLingui()
  const [verificationCode, setVerificationCode] = useState('')
  const verificationCodeId = useId()

  const channelQuery = useQuery({
    ...channelQueryOptions(channelId),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  })
  const queryClient = useQueryClient()

  useEffect(() => {
    if (channelQuery.data?.status === 'verified') {
      onSuccess()
      queryClient.invalidateQueries({
        queryKey: $qk({
          $scope: 'channels',
        }),
      })
    }
  }, [channelQuery.data, onSuccess, queryClient])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (verificationCode.trim()) {
      onVerifyCode(verificationCode.trim())
    }
  }

  return (
    <div className="space-y-4">
      <Alert>
        <Mail className="h-4 w-4" />
        <AlertDescription>
          <Trans>We sent a verification code to your email address.</Trans>
        </AlertDescription>
      </Alert>

      {isVerified && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <Trans>
              Email verified successfully! You can now receive notifications.
            </Trans>
          </AlertDescription>
        </Alert>
      )}

      {verificationError && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{verificationError}</AlertDescription>
        </Alert>
      )}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor={verificationCodeId}>
            <Trans>Verification Code</Trans>
          </Label>
          <Input
            disabled={isVerifying || isVerified}
            id={verificationCodeId}
            onChange={(e) => setVerificationCode(e.target.value)}
            placeholder={t`Enter 6-digit code`}
            required
            type="text"
            value={verificationCode}
          />
        </div>

        <Alert>
          <Mail className="h-4 w-4" />
          <AlertDescription>
            <Trans>
              Check your email for the verification code. You can also click the
              link in the email to verify automatically.
            </Trans>
          </AlertDescription>
        </Alert>

        <div className="flex gap-2 pt-4">
          <Button
            className="flex-1"
            disabled={isVerifying}
            onClick={onBackToSend}
            type="button"
            variant="outline"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            <Trans>Back</Trans>
          </Button>
          <Button
            className="flex-1"
            disabled={isVerifying || isVerified || !verificationCode.trim()}
            type="submit"
          >
            {isVerifying ? (
              <Trans>Verifying...</Trans>
            ) : (
              <Trans>Verify Code</Trans>
            )}
          </Button>
        </div>
      </form>

      {verificationError && (
        <div className="space-y-2">
          <Button
            className="w-full"
            disabled={isVerifying}
            onClick={() => onVerifyCode(verificationCode)}
          >
            <Trans>Try Again</Trans>
          </Button>
          <Button className="w-full" onClick={onBackToSend} variant="outline">
            <Trans>Use Different Email</Trans>
          </Button>
        </div>
      )}

      <Button
        className="w-full"
        disabled={isVerifying}
        onClick={onCancel}
        type="button"
        variant="outline"
      >
        <Trans>Cancel</Trans>
      </Button>
    </div>
  )
}
