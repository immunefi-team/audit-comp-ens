import { Trans, useLingui } from '@lingui/react/macro'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useAtom } from '@xstate/store-react'
import { toast } from 'sonner'
import { EnsMobileIcon } from '@/assets/icons/ens-mobile-icon'
import { Button } from '@/components/ui/button'
import { MSymbol } from '@/components/ui/material-symbol'
import {
  preferencesQueryOptions,
  updatePreferenceMutationOptions,
} from '@/features/notifications/data/queries/preferences'
import { PreferenceCard } from '@/features/notifications/settings/preference-card'
import { isBackendAuthed } from '@/utils/backend-client'
import { channelsQueryOptions } from '../data/queries/channels'

export type UseNotificationPreferencesFormOptions = {
  /**
   * When the API has no value yet, default Name Expiry on (registration) vs off
   * (notification settings page).
   */
  nameExpiryDefaultWhenUnset?: boolean
  /** Called after a successful save + refetch + form reset (e.g. registration continue). */
  onPersistSuccess?: () => void
}

export const useNotificationPreferencesForm = ({
  nameExpiryDefaultWhenUnset = false,
  onPersistSuccess,
}: UseNotificationPreferencesFormOptions) => {
  const { t } = useLingui()
  const isAuthed = useAtom(isBackendAuthed)

  const preferences = useQuery({
    ...preferencesQueryOptions,
    enabled: isAuthed,
  })

  const verifiedChannels = useQuery({
    ...channelsQueryOptions,
    select: (data) => data.filter((c) => c.status === 'verified'),
    enabled: isAuthed,
  })

  const updatePreferencesMutation = useMutation({
    ...updatePreferenceMutationOptions,
    onSuccess: () => {
      toast.success(t`Preferences updated`)
    },
    onError: (error: Error) => {
      toast.error(error.message || t`Failed to update preferences`)
    },
  })

  const form = useForm({
    defaultValues: {
      ownedNameExpiry:
        preferences.data?.settings?.ownedNameExpiry ??
        nameExpiryDefaultWhenUnset,
      ensLabsUpdates: preferences.data?.settings?.ensLabsUpdates ?? false,
      favouritedNameExpiry:
        preferences.data?.settings?.favouritedNameExpiry ?? false,
    },
    onSubmit: async ({ formApi, value }) => {
      await updatePreferencesMutation.mutateAsync(value)

      await preferences.refetch()

      formApi.reset()
      onPersistSuccess?.()
    },
  })

  const hasVerifiedChannels = (verifiedChannels.data?.length ?? 0) > 0

  return { form, preferences, hasVerifiedChannels }
}

type NotificationPreferencesFieldsProps = Pick<
  ReturnType<typeof useNotificationPreferencesForm>,
  'form' | 'preferences'
>

export const NotificationPreferencesFields = ({
  form,
  preferences,
}: NotificationPreferencesFieldsProps) => {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pb-2">
        <h2 className="font-normal font-sans text-base text-ens-blue-dark leading-ens-normal">
          <Trans>Preferences</Trans>
        </h2>
        <p className="text-ens-quartz-400 text-sm italic leading-ens-normal">
          <Trans>In-app notifications are always enabled</Trans>
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <form.Field name="ownedNameExpiry">
          {(field) => (
            <PreferenceCard
              checked={field.state.value}
              description={
                <Trans>
                  You'll be notified 30, 7, and 1 day before expiry.
                </Trans>
              }
              disabled={preferences.isRefetching}
              icon={<MSymbol className="ms-wght-300" symbol="schedule" />}
              isLoading={preferences.isLoading}
              label={<Trans>Name Expiry</Trans>}
              onChange={(checked) => field.handleChange(checked)}
              recommended
            />
          )}
        </form.Field>
        <form.Field name="ensLabsUpdates">
          {(field) => (
            <PreferenceCard
              checked={field.state.value}
              description={
                <Trans>Get updated on the latest releases and features.</Trans>
              }
              disabled={preferences.isRefetching}
              icon={<EnsMobileIcon />}
              isLoading={preferences.isLoading}
              label={<Trans>ENS Labs Updates</Trans>}
              onChange={(checked) => field.handleChange(checked)}
            />
          )}
        </form.Field>
        <form.Field name="favouritedNameExpiry">
          {(field) => (
            <PreferenceCard
              checked={field.state.value}
              description={
                <Trans>Get notified when names you favorited expire.</Trans>
              }
              disabled={preferences.isRefetching}
              icon={<MSymbol className="ms-wght-300" symbol="favorite" />}
              isLoading={preferences.isLoading}
              label={<Trans>Favourites</Trans>}
              onChange={(checked) => field.handleChange(checked)}
            />
          )}
        </form.Field>
      </div>
    </>
  )
}

export const NotificationPreferences = () => {
  const { form, preferences, hasVerifiedChannels } =
    useNotificationPreferencesForm({
      nameExpiryDefaultWhenUnset: false,
    })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-xl border-[#ddddde] border-[0.5px] bg-white p-6 shadow-[0px_4px_24.1px_rgba(7,28,47,0.07)]">
        <NotificationPreferencesFields form={form} preferences={preferences} />
      </div>
      <div className="ml-auto w-full max-w-md">
        <form.Subscribe
          selector={(state) => [
            state.canSubmit,
            state.isSubmitting,
            state.isDefaultValue,
          ]}
        >
          {([canSubmit, isSubmitting, isDefaultValue]) => (
            <Button
              className="w-full uppercase"
              disabled={!canSubmit || !hasVerifiedChannels || isDefaultValue}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                form.handleSubmit()
              }}
              size="xl"
              variant="lightBlue"
            >
              {isSubmitting ? (
                <Trans>Saving...</Trans>
              ) : (
                <Trans>Save Preferences</Trans>
              )}
            </Button>
          )}
        </form.Subscribe>
        {!hasVerifiedChannels && (
          <p className="mt-2 text-base text-slate-600 leading-ens-normal">
            <Trans>
              Verify at least one contact method to save preferences
            </Trans>
          </p>
        )}
      </div>
    </div>
  )
}
