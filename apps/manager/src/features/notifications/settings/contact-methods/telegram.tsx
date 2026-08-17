import { Trans, useLingui } from '@lingui/react/macro'
import {
  AlertDialogAction as AlertDialogActionPrimitive,
  AlertDialogCancel as AlertDialogCancelPrimitive,
} from '@radix-ui/react-alert-dialog'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { match, P } from 'ts-pattern'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { MSymbol } from '@/components/ui/material-symbol'
import {
  addTelegramChannelMutationOptions,
  type Channel,
  deleteChannelMutationOptions,
  telegramAuthMutationOptions,
} from '@/features/notifications/data/queries/channels'
import { ContactMethodCard } from './contact-method-card'

const TELEGRAM_BOT_USERNAME = '@ens_earl_bot'

export const TelegramContactMethod = ({ telegram }: { telegram?: Channel }) => {
  const { t } = useLingui()

  const addTelegramChannelMutation = useMutation({
    ...addTelegramChannelMutationOptions,
    onSuccess: () => {
      toast.success(t`Telegram channel added`)
    },
    onError: (error: Error) => {
      toast.error(error.message || t`Failed to add Telegram channel`)
    },
  })

  const telegramAuthMutation = useMutation({
    ...telegramAuthMutationOptions,
    onSuccess: (authData) => {
      addTelegramChannelMutation.mutate({ auth_data: authData })
    },
    onError: (error: Error) => {
      toast.error(error.message || t`Failed to authenticate with Telegram`)
    },
  })

  const deleteMutation = useMutation({
    ...deleteChannelMutationOptions,
    onMutate: (id) => {
      toast.loading(t`Removing telegram channel`, {
        id: `remove-telegram-${id}`,
        description: t`Removing telegram for ${telegram?.label}`,
      })
    },
    onSuccess: (_, id) => {
      toast.success(t`Telegram channel removed`, {
        id: `remove-telegram-${id}`,
      })

      telegramAuthMutation.reset()
      addTelegramChannelMutation.reset()
    },
    onError: (error: Error, id) => {
      toast.error(error.message || t`Failed to remove Telegram channel`, {
        id: `remove-telegram-${id}`,
      })
    },
  })

  if (!telegram) {
    const isPending =
      telegramAuthMutation.isPending || addTelegramChannelMutation.isPending

    const statusMessage = match({
      authPending: telegramAuthMutation.isPending,
      error: telegramAuthMutation.error ?? addTelegramChannelMutation.error,
      addPending: addTelegramChannelMutation.isPending,
    })
      .with({ authPending: true }, () => (
        <p className="text-[#45556C] text-sm leading-ens-normal">
          <Trans>Please sign in to telegram in the popup window.</Trans>
        </p>
      ))
      .with({ addPending: true }, () => (
        <p className="text-[#45556C] text-sm leading-ens-normal">
          <Trans>Adding telegram...</Trans>
        </p>
      ))
      .with({ error: P.not(P.nullish) }, ({ error }) => (
        <p className="text-destructive text-sm leading-ens-normal">
          <span className="font-medium">
            <Trans>Failed to add telegram: </Trans>
          </span>
          <span>{error.message}</span>
        </p>
      ))
      .otherwise(() => null)

    return (
      <ContactMethodCard
        actionLabel={t`Telegram Notifications`}
        actionLoading={isPending}
        description={t`Get instant updates through Telegram for your domains.`}
        icon={
          <MSymbol
            className="ms-opsz-18 ms-wght-400 text-ens-lapis-core not-italic leading-[19.6px]"
            symbol="message"
          />
        }
        onAction={() => telegramAuthMutation.mutate()}
        variant="tg"
      >
        {statusMessage}
      </ContactMethodCard>
    )
  }

  return (
    <ContactMethodCard
      action={
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              className="flex w-fit items-center gap-3 rounded-full bg-[#54a9ec] px-4 py-3 transition-colors hover:bg-[#3b95d8]"
              type="button"
            >
              <span className="font-normal text-sm text-white leading-ens-normal">
                {telegram.label}
              </span>
              <MSymbol className="ms-wght-300 text-ens-white" symbol="close" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                <Trans>Remove Telegram Contact Method?</Trans>
              </AlertDialogTitle>
              <AlertDialogDescription>
                <Trans>
                  You may miss important notifications if you remove this
                  contact method. Are you sure you want to continue?
                </Trans>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row md:ml-auto md:w-2/3">
              <AlertDialogCancelPrimitive asChild>
                <Button
                  className="flex-1/3 uppercase"
                  size="lg"
                  variant="outline"
                >
                  <Trans>Cancel</Trans>
                </Button>
              </AlertDialogCancelPrimitive>
              <AlertDialogActionPrimitive asChild>
                <Button
                  className="flex-2/3 uppercase"
                  onClick={() => {
                    deleteMutation.mutate(telegram.id)
                  }}
                  size="lg"
                  variant="lightBlue"
                >
                  <Trans>Remove</Trans>
                </Button>
              </AlertDialogActionPrimitive>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      }
      description={
        telegram.status === 'pending' ? (
          <Trans>Pending verification</Trans>
        ) : (
          <Trans>Connected</Trans>
        )
      }
      icon={
        <MSymbol
          className="ms-opsz-18 ms-wght-400 text-ens-lapis-core not-italic leading-[19.6px]"
          symbol="message"
        />
      }
      title={<Trans>Telegram</Trans>}
    >
      {telegram.status === 'pending' && (
        <p className="text-[#45556C] text-sm leading-ens-normal">
          <Trans>
            To finish connecting Telegram, you need to{' '}
            <a
              className="text-[#54A9EC] underline hover:text-[#357bb8]"
              href={`https://t.me/${TELEGRAM_BOT_USERNAME.replace(/^@/, '')}?start`}
              rel="noopener noreferrer"
              target="_blank"
            >
              start the ENS Notifications Bot
            </a>{' '}
            in Telegram.
          </Trans>
        </p>
      )}
    </ContactMethodCard>
  )
}
