import { Trans } from '@lingui/react/macro'
import { useQuery } from '@tanstack/react-query'
import { CircleChevronDown } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { channelsQueryOptions } from '@/features/notifications/data/queries/channels'
import { EmailContactMethod } from './email'
import { PushContactMethod } from './push'
import { TelegramContactMethod } from './telegram'

export const ContactMethods = () => {
  const channels = useQuery({
    ...channelsQueryOptions,
    select: (data) => ({
      email: data.find((c) => c.channel === 'email'),
      telegram: data.find((c) => c.channel === 'telegram'),
      push: data.filter((c) => c.channel === 'push'),
    }),
  })

  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-normal font-sans text-base text-ens-blue-dark leading-ens-normal">
        <Trans>Contact methods</Trans>
      </h2>
      <EmailContactMethod email={channels.data?.email} />
      <Collapsible>
        <CollapsibleTrigger asChild>
          <button
            className="group inline-flex w-fit items-center gap-2 text-ens-quartz-400 transition-colors hover:text-[#515151]"
            type="button"
          >
            <CircleChevronDown
              aria-hidden
              className="size-4 shrink-0 stroke-1 transition-transform duration-150 ease-out group-data-[state=open]:rotate-180 motion-reduce:transition-none"
            />
            <span className="font-normal font-sans text-base leading-ens-normal">
              <Trans>Add more contact methods</Trans>
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden duration-150 ease-out data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down motion-reduce:animate-none [&>div]:transition-opacity [&>div]:duration-150 [&>div]:ease-out data-[state=closed]:[&>div]:opacity-0 data-[state=open]:[&>div]:opacity-100 motion-reduce:[&>div]:transition-none">
          <div className="flex flex-col gap-2 pt-2">
            <TelegramContactMethod telegram={channels.data?.telegram} />
            <PushContactMethod pushChannels={channels.data?.push ?? []} />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
