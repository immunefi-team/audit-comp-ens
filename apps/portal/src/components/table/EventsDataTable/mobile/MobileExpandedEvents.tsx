import type { Address } from 'viem'
import { AddressDisplay } from '@/components/table/EventsDataTable/AddressDisplay'
import { extractFromAddress } from '@/utils/events/extractFromAddress'
import type { BaseEvent } from '../types'

interface MobileExpandedEventsProps<TEvent extends BaseEvent> {
  events: TEvent[]
}

export const MobileExpandedEvents = <TEvent extends BaseEvent = BaseEvent>({
  events,
}: MobileExpandedEventsProps<TEvent>) => {
  return (
    <>
      {events.map((event, index) => {
        const eventDetails = event.details as Record<string, unknown>
        const fromAddress = extractFromAddress(eventDetails)

        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: multiple events can share an id within one transaction, so event.id is not guaranteed unique; the index disambiguates same-id siblings
            key={`${event.id}-${index}`}
            className="pl-4 border-l-2 border-border flex flex-col gap-2"
          >
            <div className="text-sm font-medium">Event</div>
            <div className="text-base">{event.type}</div>
            {fromAddress && (
              <>
                <div className="text-sm font-medium">From</div>
                <AddressDisplay address={fromAddress as Address} />
              </>
            )}
          </div>
        )
      })}
    </>
  )
}
