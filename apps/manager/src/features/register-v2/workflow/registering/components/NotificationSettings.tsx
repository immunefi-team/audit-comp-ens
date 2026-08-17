import { Trans } from '@lingui/react/macro'
import { useAtom } from '@xstate/store-react'
import { Button } from '@/components/ui/button'
import { ContactMethods } from '@/features/notifications/settings/contact-methods'
import {
  NotificationPreferencesFields,
  useNotificationPreferencesForm,
} from '@/features/notifications/settings/preferences'
import { RegistrationMobileCtaBar } from '@/features/notifications/settings/registration-mobile-cta-bar'
import { backendAuthStore, isBackendAuthed } from '@/utils/backend-client'

export interface NotificationSettingsProps {
  onConfirm: () => void
  onSkip: () => void
}

export const NotificationSettings = ({
  onConfirm,
  onSkip,
}: NotificationSettingsProps) => {
  const isAuthed = useAtom(isBackendAuthed)

  const { form, preferences, hasVerifiedChannels } =
    useNotificationPreferencesForm({
      nameExpiryDefaultWhenUnset: true,
      onPersistSuccess: onConfirm,
    })

  return (
    <div className="mx-auto w-full max-w-5xl px-2 py-8 max-md:pb-[max(7.5rem,calc(env(safe-area-inset-bottom,0px)+6.5rem))] lg:my-5">
      <div className="flex flex-col gap-4 pb-6">
        <h1 className="font-normal font-sans text-[#232222] text-[28px] leading-ens-none tracking-[0.01em]">
          <Trans>Never lose your name to expiry.</Trans>
        </h1>
        <div className="text-base text-slate-600 leading-ens-normal">
          <p>
            <Trans>You'll always see important notifications in the app.</Trans>
          </p>
          <p>
            <Trans>
              Add an external contact method if you also want reminders by email
              or Telegram or in your browser.
            </Trans>
          </p>
        </div>
      </div>

      {isAuthed ? (
        <div className="grid grid-cols-1 items-start gap-2 md:grid-cols-[3fr_2fr]">
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border-[#ddddde] border-[0.5px] bg-white p-6 shadow-[0px_4px_24.1px_rgba(7,28,47,0.07)]">
              <ContactMethods />
            </div>
            <RegistrationMobileCtaBar>
              <form.Subscribe
                selector={(state) => [state.canSubmit, state.isSubmitting]}
              >
                {([canSubmit, isSubmitting]) => (
                  <Button
                    className="uppercase tracking-[0.12em] max-md:min-h-12 max-md:flex-1 max-md:basis-0 max-md:rounded-xl max-md:py-3.5"
                    disabled={
                      !canSubmit || !hasVerifiedChannels || isSubmitting
                    }
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      form.handleSubmit()
                    }}
                    size="lg"
                    variant="lightBlue"
                  >
                    {isSubmitting ? (
                      <Trans>Saving...</Trans>
                    ) : (
                      <Trans>Save and Continue</Trans>
                    )}
                  </Button>
                )}
              </form.Subscribe>
              <Button
                className="uppercase tracking-[0.12em] max-md:min-h-12 max-md:shrink-0 max-md:rounded-xl max-md:px-4 max-md:py-3 max-md:font-mono max-md:text-ens-blue-dark max-md:text-xs max-md:shadow-none max-md:active:bg-ens-blue-light/60 max-md:hover:bg-ens-blue-light/40 md:bg-ens-lapis-100 md:text-ens-lapis-500 md:active:bg-[#a9d5ed] md:hover:bg-[#c4e7f3]"
                onClick={onSkip}
                size="lg"
                variant="ghost"
              >
                <Trans>Set up later</Trans>
              </Button>
            </RegistrationMobileCtaBar>
          </div>

          <div className="flex flex-col gap-4 rounded-xl border-[#ddddde] border-[0.5px] bg-white p-6 shadow-[0px_4px_24.1px_rgba(7,28,47,0.07)]">
            <NotificationPreferencesFields
              form={form}
              preferences={preferences}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-xl border-[#ddddde] border-[0.5px] bg-white p-6 shadow-[0px_4px_24.1px_rgba(7,28,47,0.07)]">
          <p className="text-base text-slate-600 leading-ens-normal">
            <Trans>
              You need to verify your wallet ownership to manage your
              notification preferences.
            </Trans>
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              className="uppercase tracking-[0.12em]"
              onClick={() => {
                backendAuthStore.trigger.resetModal()
              }}
              size="lg"
              variant="lightBlue"
            >
              <Trans>Verify Wallet</Trans>
            </Button>
            <Button
              className="bg-ens-lapis-100 text-ens-lapis-500 uppercase tracking-[0.12em] hover:bg-[#c4e7f3] active:bg-[#a9d5ed]"
              onClick={onSkip}
              size="lg"
              variant="lightBlue"
            >
              <Trans>Set up later</Trans>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
