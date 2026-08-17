import { Trans } from '@lingui/react/macro'
import type { ReactNode } from 'react'
import { match } from 'ts-pattern'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

export type ResolverSetupConfirmIntent = 'primary-name' | 'edit-profile'

interface ResolverSetupConfirmDialogProps {
  readonly intent: ResolverSetupConfirmIntent
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onConfirm: () => void
}

const getCopy = (
  intent: ResolverSetupConfirmIntent,
): { title: ReactNode; description: ReactNode; confirmLabel: ReactNode } =>
  match(intent)
    .with('primary-name', () => ({
      title: <Trans>Set this as your primary name?</Trans>,
      description: (
        <Trans>
          This name still has profile details from a previous owner. To use it
          as your primary name, we’ll clear those details and keep only your
          wallet address.
        </Trans>
      ),
      confirmLabel: <Trans>Replace & Continue</Trans>,
    }))
    .with('edit-profile', () => ({
      title: <Trans>Start a new profile for this name?</Trans>,
      description: (
        <Trans>
          This name still has profile details from a previous owner. Continuing
          clears them and keeps only the changes you save.
        </Trans>
      ),
      confirmLabel: <Trans>Replace & Save</Trans>,
    }))
    .exhaustive()

export const ResolverSetupConfirmDialog = ({
  intent,
  open,
  onOpenChange,
  onConfirm,
}: ResolverSetupConfirmDialogProps) => {
  const { title, description, confirmLabel } = getCopy(intent)

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row md:ml-auto md:w-2/3">
          <Button
            className="flex-1/3 uppercase"
            onClick={() => onOpenChange(false)}
            size="lg"
            variant="outline"
          >
            <Trans>Cancel</Trans>
          </Button>
          <Button
            className="flex-2/3 uppercase"
            onClick={() => {
              // Confirm before close — edit-profile clears the deferred save
              // when the dialog closes, so reversing this no-ops Replace & Save.
              onConfirm()
              onOpenChange(false)
            }}
            size="lg"
            variant="destructive"
          >
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
