import { ScrollTextIcon } from 'lucide-react'
import { useState } from 'react'
import type { Hash } from 'viem'
import { useTransactionReceipt } from 'wagmi'
import { CopyableRecord } from '@/components/CopyableRecord'
import { InfoRow } from '@/components/InfoCard'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  getEventFieldType,
  getEventSignature,
} from '@/utils/ens/eventSignatures'
import { formatEventValue } from '@/utils/ens/formatEventValue'
import { truncateAddress } from '@/utils/formatting/truncateAddress'
import { filterEventDetailsMetadata } from '@/utils/history/filterEventDetailsMetadata'
import { parseEventLogIndex } from '@/utils/history/parseEventLogIndex'
import type { ENSEvent } from '@/utils/history/transformHistoryToEvents'

interface EventDataProps {
  event: ENSEvent
  txHash: Hash
}

const EventData = ({ event, txHash }: EventDataProps) => {
  const [showDecoded, setShowDecoded] = useState(true)

  const { data: receipt } = useTransactionReceipt({
    hash: txHash,
  })

  // Find the matching log for this event by matching the log index from the event ID
  const parsedLogIndex = parseEventLogIndex(event.id)

  // Match by logIndex property
  const eventLog = receipt?.logs.find((log) => log.logIndex === parsedLogIndex)

  // Filter out metadata fields from details
  const dataFields = filterEventDetailsMetadata(event.details)

  return (
    <div>
      <div className="w-full flex items-center justify-between">
        <h4 className="text-caps leading-none text-foreground">Data</h4>

        <div className="flex items-center gap-3 mb-4">
          <Label htmlFor="showDecoded">
            {showDecoded ? 'Decoded' : 'Encoded'}
          </Label>
          <Switch
            checked={showDecoded}
            onCheckedChange={() => setShowDecoded((prev) => !prev)}
          />
        </div>
      </div>

      {showDecoded ? (
        <div className="border rounded-sm overflow-auto">
          <Table className="[&_th:first-child]:pl-4 [&_td:first-child]:pl-4 [&_th:last-child]:pr-4 [&_td:last-child]:pr-4">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dataFields.map(([key, value], index) => (
                <TableRow key={key} className="hover:bg-muted">
                  <TableCell className="h-10 py-0 text-sm">{index}</TableCell>
                  <TableCell className="h-10 py-0 text-sm">{key}</TableCell>
                  <TableCell className="h-10 py-0 text-sm">
                    {getEventFieldType(event.type, key)}
                  </TableCell>
                  <TableCell className="h-10 py-0 text-sm">
                    <CopyableRecord
                      value={String(value)}
                      displayValue={
                        <span className="break-all">
                          {formatEventValue(key, value)}
                        </span>
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="bg-muted p-4 rounded-sm">
          {eventLog ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Data:
                </p>
                <CopyableRecord
                  value={eventLog.data}
                  displayValue={
                    <p className="text-xs font-mono break-all text-foreground">
                      {eventLog.data}
                    </p>
                  }
                />
              </div>
              {eventLog.topics.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Topics:
                  </p>
                  <div className="space-y-2">
                    {eventLog.topics.map((topic, i) => (
                      <CopyableRecord
                        key={topic}
                        value={topic}
                        displayValue={
                          <p className="text-xs font-mono break-all text-foreground">
                            [{i}]: {topic}
                          </p>
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Encoded data not available. Transaction receipt may still be
              loading.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

interface TransactionEventsProps {
  events: ENSEvent[]
  txHash: Hash
}

export const TransactionEvents = ({
  events,
  txHash,
}: TransactionEventsProps) => {
  if (events.length === 0) {
    return (
      <div className="text-muted-foreground text-center py-6">
        No events found
      </div>
    )
  }

  const firstEventId = `${events[0].id}-0`

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-caps leading-none text-foreground">
        {events.length} events
      </h3>
      <div className="border rounded-sm overflow-hidden">
        <Tabs defaultValue={firstEventId} className="w-full">
          <div className="overflow-x-auto">
            <TabsList className="w-full justify-start rounded-none p-0 inline-flex">
              {events.map((event, index) => (
                <TabsTrigger
                  // biome-ignore lint/suspicious/noArrayIndexKey: the index is part of the tab's stable value (multiple events can share an id within one transaction) and mirrors the value prop used for tab matching
                  key={`${event.id}-${index}`}
                  value={`${event.id}-${index}`}
                  className="whitespace-nowrap py-4"
                >
                  {event.type}{' '}
                  {events.filter((e) => e.type === event.type).length > 1
                    ? `#${index + 1}`
                    : ''}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {events.map((event, index) => (
            <TabsContent
              // biome-ignore lint/suspicious/noArrayIndexKey: the index is part of the tab's stable value (multiple events can share an id within one transaction) and mirrors the value prop used for tab matching
              key={`${event.id}-${index}`}
              value={`${event.id}-${index}`}
              className="p-6"
            >
              <div className="flex flex-col gap-8">
                <div className="flex flex-col gap-4 w-full">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-2 w-full">
                    <CopyableRecord
                      value={event.type}
                      displayValue={
                        <h3 className="text-xl font-medium">{event.type}</h3>
                      }
                    />

                    <Button variant="ghost" asChild size="sm">
                      <a
                        href="https://github.com/ensdomains/ens-contracts"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5"
                      >
                        <ScrollTextIcon />
                        <span className="text-sm">Go to docs</span>
                      </a>
                    </Button>
                  </div>
                  <div className="[&_[data-slot=info-row]]:px-0">
                    <InfoRow label="Transaction">
                      <CopyableRecord
                        value={txHash}
                        displayValue={
                          <span className="flex items-center gap-1">
                            {truncateAddress(txHash, 10, 8, '...')}
                          </span>
                        }
                        className="text-sm flex-1 min-w-0"
                      />
                    </InfoRow>
                    <InfoRow label="Event">
                      <CopyableRecord
                        value={getEventSignature(event.type)}
                        displayValue={
                          <div className="w-full max-w-110">
                            {getEventSignature(event.type)}
                          </div>
                        }
                        truncate={false}
                      />
                    </InfoRow>
                  </div>
                </div>
                <EventData event={event} txHash={txHash} />
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  )
}
