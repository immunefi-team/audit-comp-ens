import { TaggedError } from '@ens-apps/utils/neverthrow'
import { err, ok, type Result } from 'neverthrow'
import type { PropsWithChildren } from 'react'
import type { Address, Hash } from 'viem'
import { useTransaction } from 'wagmi'
import { CopyableRecord } from '@/components/CopyableRecord'
import { InfoCard, InfoRow } from '@/components/InfoCard'
import { AddressDisplay } from '@/components/table/EventsDataTable/AddressDisplay'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ResolverEvent } from '@/features/resolver/hooks/useResolverOverview'
import { useIsMobile } from '@/hooks/use-mobile'
import { useBlockExplorerTxUrl } from '@/utils/blockExplorer/useBlockExplorerUrl'
import {
  getEventFieldType,
  getEventSignature,
} from '@/utils/ens/eventSignatures'
import { formatTimestamp } from '@/utils/formatting/formatTimestamp'
import { truncateAddress } from '@/utils/formatting/truncateAddress'

type EventWithFrom = ResolverEvent & {
  readonly from?: Address | null
}

interface EventDetailSheetProps extends PropsWithChildren {
  readonly event: EventWithFrom | null
  readonly open: boolean
  readonly setOpen: React.Dispatch<React.SetStateAction<boolean>>
}

class ParseEventDataError extends TaggedError('ParseEventDataError')<{
  cause: unknown
  raw: string
}> {}

const parseEventData = (
  data: string,
): Result<Record<string, string>, ParseEventDataError> => {
  try {
    return ok(JSON.parse(data) as Record<string, string>)
  } catch (cause) {
    return err(new ParseEventDataError({ cause, raw: data }))
  }
}

const TransactionDetails = ({ event }: { readonly event: EventWithFrom }) => {
  const txHash = event.transactionHash as Hash | undefined
  const txUrl = useBlockExplorerTxUrl(txHash)

  const {
    data: txData,
    isLoading,
    error,
  } = useTransaction({
    hash: txHash,
    query: { enabled: !!txHash },
  })

  const formattedTimestamp = event.timestamp
    ? formatTimestamp(BigInt(event.timestamp))
    : null

  const parsedResult = parseEventData(event.data)

  if (isLoading) {
    return (
      <div className="p-6 flex flex-col gap-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 flex flex-col gap-4">
        <div className="text-danger">
          Error loading transaction: {error.message}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 flex flex-col gap-6 [&_[data-slot=info-card-title]]:px-0 [&_[data-slot=info-row]]:px-0 sm:[&_[data-slot=info-row]]:h-10">
      <InfoCard title="Transaction details">
        {txHash && (
          <InfoRow label="Tx Hash">
            <div className="pl-3.5">
              <CopyableRecord
                value={txHash}
                displayValue={
                  <span className="flex items-center gap-1">
                    {truncateAddress(txHash, 10, 8, '...')}
                  </span>
                }
                href={txUrl}
              />
            </div>
          </InfoRow>
        )}

        {formattedTimestamp && (
          <InfoRow label="Timestamp">
            <div className="pl-3.5">
              <CopyableRecord
                value={formattedTimestamp}
                displayValue={<span>{formattedTimestamp} UTC</span>}
              />
            </div>
          </InfoRow>
        )}

        {txData && (
          <>
            <InfoRow label="Network">
              <span className="text-sm">Sepolia</span>
            </InfoRow>

            <InfoRow label="From">
              <AddressDisplay address={txData.from} />
            </InfoRow>

            <InfoRow label="To">
              {txData.to ? (
                <AddressDisplay address={txData.to} />
              ) : (
                <span className="text-sm text-muted-foreground">
                  Contract Creation
                </span>
              )}
            </InfoRow>
          </>
        )}
      </InfoCard>

      <div className="flex flex-col gap-4">
        <h3 className="text-caps leading-none text-foreground">1 event</h3>

        <div className="border rounded-sm overflow-hidden">
          <div className="border-b px-6 py-3 bg-muted">
            <span className="text-sm font-medium">{event.type}</span>
          </div>

          <div className="p-6 flex flex-col gap-8">
            <div className="flex flex-col gap-4 w-full [&_[data-slot=info-row]]:px-0">
              <CopyableRecord
                value={event.type}
                displayValue={
                  <h3 className="text-xl font-medium">{event.type}</h3>
                }
              />

              {txHash && (
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
              )}

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

            {parsedResult.match(
              (parsed) => (
                <div>
                  <h4 className="text-caps leading-none text-foreground mb-3">
                    Data
                  </h4>
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
                        {Object.entries(parsed).map(([key, value], index) => (
                          <TableRow key={key} className="hover:bg-muted">
                            <TableCell className="h-10 py-0 text-sm">
                              {index}
                            </TableCell>
                            <TableCell className="h-10 py-0 text-sm">
                              {key}
                            </TableCell>
                            <TableCell className="h-10 py-0 text-sm">
                              {getEventFieldType(event.type, key)}
                            </TableCell>
                            <TableCell className="h-10 py-0 text-sm">
                              <CopyableRecord
                                value={String(value)}
                                displayValue={
                                  <span className="break-all">{value}</span>
                                }
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ),
              (parseError) => (
                <div>
                  <h4 className="text-caps leading-none text-foreground mb-3">
                    Data
                  </h4>
                  <div className="border rounded-sm p-4 flex flex-col gap-2">
                    <span className="text-sm text-danger">
                      Unable to parse event data
                    </span>
                    <CopyableRecord
                      value={parseError.raw}
                      displayValue={
                        <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all">
                          {parseError.raw}
                        </pre>
                      }
                    />
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export const EventDetailSheet = ({
  children,
  event,
  open,
  setOpen,
}: EventDetailSheetProps) => {
  const isMobile = useIsMobile()

  return (
    <Sheet open={open} onOpenChange={setOpen} defaultOpen={false}>
      {children}
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className="bg-background p-0 flex flex-col h-dvh"
      >
        <div className="p-6 pb-0 shrink-0">
          <SheetHeader className="p-0">
            <SheetTitle className="font-sans text-h2">Transaction</SheetTitle>
          </SheetHeader>
        </div>

        <div className="flex-1 overflow-y-auto">
          {event ? (
            <TransactionDetails event={event} />
          ) : (
            <div className="text-muted-foreground text-center py-12">
              No transaction selected
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
