import { createFileRoute } from '@tanstack/react-router'
import { ContactMethods } from '@/features/notifications/settings/contact-methods'
import { NotificationPreferences } from '@/features/notifications/settings/preferences'

export const NotificationSettingsPage = () => {
  return (
    <div className="mx-auto w-full max-w-5xl px-2 py-8 lg:my-5">
      <div className="flex flex-col gap-4 pb-6">
        <h1 className="font-[350] text-[#232222] text-temp-32px leading-ens-none">
          Notification Settings
        </h1>

        <p className="text-[#717182] text-base">
          Manage your notification preferences for your name(s) and ENS-related
          updates.
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-2 md:grid-cols-[3fr_2fr]">
        <div className="rounded-xl border-[#ddddde] border-[0.5px] bg-white p-6 shadow-[0px_4px_24.1px_rgba(7,28,47,0.07)]">
          <ContactMethods />
        </div>

        <NotificationPreferences />
      </div>
    </div>
  )
}

export const Route = createFileRoute('/notifications/_authenticated/settings/')(
  {
    component: NotificationSettingsPage,
  },
)
