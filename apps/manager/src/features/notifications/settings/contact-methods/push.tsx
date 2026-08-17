import { Trans, useLingui } from '@lingui/react/macro'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { match } from 'ts-pattern'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { MSymbol } from '@/components/ui/material-symbol'
import { Switch } from '@/components/ui/switch'
import type { Channel } from '@/features/notifications/data/queries/channels'
import {
  browserPushStateQueryOptions,
  disableBrowserPushMutationOptions,
  enableBrowserPushMutationOptions,
} from '@/features/notifications/data/queries/push'
import { ContactMethodCard } from './contact-method-card'

type PushContactMethodProps = {
  pushChannels: Channel[]
}

const isPushChannelWithEndpointHash = (
  channel: Channel,
): channel is Channel & { channel: 'push'; endpointHash: string } => {
  return (
    channel.channel === 'push' &&
    'endpointHash' in channel &&
    typeof channel.endpointHash === 'string'
  )
}

export const PushContactMethod = ({ pushChannels }: PushContactMethodProps) => {
  const { t } = useLingui()
  const queryClient = useQueryClient()

  const browserState = useQuery(browserPushStateQueryOptions)

  const enableMutation = useMutation({
    ...enableBrowserPushMutationOptions,
    onSuccess: () => {
      toast.success(t`Browser notifications enabled`)
      browserState.refetch()
    },
    onError: (error) => {
      console.error(error)
      toast.error(error.message || error._tag)
      browserState.refetch()
    },
  })

  const disableMutation = useMutation({
    ...disableBrowserPushMutationOptions(queryClient),
    onSuccess: () => {
      toast.success(t`Browser notifications disabled`)
      browserState.refetch()
    },
    onError: (error) => {
      toast.error(error.message || error._tag)
      browserState.refetch()
    },
  })

  const isPending = enableMutation.isPending || disableMutation.isPending
  const permission = browserState.data?.permission ?? 'default'
  const isSupported = browserState.data?.isSupported ?? false
  const endpointHash = browserState.data?.endpointHash

  const matchedChannel = endpointHash
    ? pushChannels.find(
        (channel) =>
          isPushChannelWithEndpointHash(channel) &&
          channel.endpointHash === endpointHash,
      )
    : undefined

  const isEnabled = Boolean(matchedChannel)

  const onToggle = (checked: boolean) => {
    if (checked) {
      enableMutation.mutate()
      return
    }

    disableMutation.mutate()
  }

  const action = match({ isSupported, permission })
    .with({ isSupported: true, permission: 'granted' }, () => (
      <Switch
        checked={isEnabled}
        disabled={isPending || browserState.isFetching}
        onCheckedChange={onToggle}
      />
    ))
    .otherwise(() => null)

  const showEnableButton = isSupported && permission === 'default'

  return (
    <ContactMethodCard
      action={action ?? undefined}
      actionDisabled={isPending || browserState.isFetching}
      actionLabel={showEnableButton ? t`Enable` : undefined}
      description={t`Get instant push notifications in your browser`}
      icon={
        <MSymbol
          className="ms-opsz-18 ms-wght-400 text-ens-lapis-core not-italic leading-[19.6px]"
          symbol="computer"
        />
      }
      onAction={showEnableButton ? () => enableMutation.mutate() : undefined}
      title={<Trans>Browser Notifications</Trans>}
      variant="browser-not"
    >
      {isSupported && permission === 'denied' && (
        <Alert variant="destructive">
          <MSymbol className="ms-opsz-16 ms-wght-300 block" symbol="warning" />
          <AlertTitle>
            <Trans>Notifications blocked</Trans>
          </AlertTitle>
          <AlertDescription>
            <Trans>
              To enable, go to your browser's site settings for this page and
              allow notifications.
            </Trans>
          </AlertDescription>
        </Alert>
      )}
    </ContactMethodCard>
  )
}
