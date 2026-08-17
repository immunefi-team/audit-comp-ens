import { ens_split } from '@adraffy/ens-normalize'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import {
  ArrowRightFromLineIcon,
  CheckCircleIcon,
  InfoIcon,
  XCircleIcon,
} from 'lucide-react'
import type { Address, Hex } from 'viem'
import { labelhash, namehash } from 'viem/ens'
import { EntityBadge } from '@/components/EntityBadge'
import { ErrorMessage } from '@/components/ErrorMessage'
import { InfoCard, InfoRow } from '@/components/InfoCard'
import { LoadingMessage } from '@/components/LoadingMessage'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { NotFoundMessage } from '@/components/NotFoundMessage'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { InfoRow as HeaderInfoRow } from '@/features/profile/components/InfoRow'
import { getEnsOwnerQueryOptions } from '@/features/profile/hooks/useEnsOwner'
import { getTokenIdQueryOptions } from '@/features/profile/hooks/useTokenId'
import { getWrapperDataQueryOptions } from '@/features/resolver/hooks/useWrapperData'
import { useContractAddress } from '@/hooks/useContractAddress'
import { cn } from '@/lib/utils'
import { asciiEncode } from '@/utils/token/ascii'
import { dnsEncodeName } from '@/utils/token/dnsEncodeName'
import { escapeUnicode } from '@/utils/token/escapeUnicode'
import { isNormalized } from '@/utils/token/isNormalized'
import type { ProtocolVersion } from '@/utils/types'

export const Route = createFileRoute('/$name/token')({
  component: RouteComponent,
  notFoundComponent: () => <NotFoundMessage />,
})

const TokenInfoCard = ({
  contractAddress,
  tokenId,
  hex,
  tokenStandard,
  protocolVersion,
}: {
  contractAddress: Address
  tokenId: string
  hex: Hex
  tokenStandard: 'ERC-1155' | 'ERC-721'
  protocolVersion: ProtocolVersion
}) => {
  return (
    <div className="flex flex-col">
      <HeaderInfoRow label="Protocol">
        <span className="text-entity-base text-foreground">
          {protocolVersion}
        </span>
      </HeaderInfoRow>

      <HeaderInfoRow label="Token Standard">
        <EntityBadge type="content" variant="default" copyValue={tokenStandard}>
          {tokenStandard}
        </EntityBadge>
      </HeaderInfoRow>

      <HeaderInfoRow label="Contract">
        <EntityBadge variant="contract" address={contractAddress}>
          {contractAddress}
        </EntityBadge>
      </HeaderInfoRow>

      <HeaderInfoRow label="Token ID">
        <div className="flex items-center gap-4 justify-between w-full ">
          <div className="flex-1 min-w-0">
            <EntityBadge type="content" variant="default" copyValue={tokenId}>
              <span className="truncate max-w-[30vw] sm:max-w-167.5">
                {tokenId}
              </span>
            </EntityBadge>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="default" size="sm" className="gap-1 shrink-0">
                <ArrowRightFromLineIcon className="size-4" />
                <span className="text-xs font-medium">More</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full p-0">
              <div className="h-full overflow-y-auto">
                <div className="flex flex-col gap-6 p-6 **:data-[slot=info-row]:px-0">
                  <SheetHeader className="p-0">
                    <SheetTitle className="font-sans text-h2">
                      Token ID
                    </SheetTitle>
                  </SheetHeader>
                  <div className="sm:**:data-[slot=info-row]:h-10">
                    <InfoRow label="Hash">
                      <div className="min-w-0 w-full">
                        <EntityBadge
                          type="content"
                          variant="default"
                          format="wrap"
                          copyValue={tokenId}
                        >
                          {tokenId}
                        </EntityBadge>
                      </div>
                    </InfoRow>

                    <InfoRow label="HEX">
                      <div className="min-w-0 w-full">
                        <EntityBadge
                          type="content"
                          variant="default"
                          format="wrap"
                          copyValue={hex}
                        >
                          {hex}
                        </EntityBadge>
                      </div>
                    </InfoRow>

                    <InfoRow label="Last changed">
                      <span className="font-mono text-sm ">—</span>
                    </InfoRow>
                  </div>

                  <div className="bg-muted rounded-lg p-3 flex gap-2 items-start">
                    <InfoIcon className="size-6 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-base">
                      The Token ID will change anytime the roles are updated.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-caps leading-none text-foreground mb-4">
                      History
                    </h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Transaction</TableHead>
                          <TableHead>Token ID Hash</TableHead>
                          <TableHead>Token ID HEX</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="text-center py-8 text-muted-foreground"
                          >
                            No history available
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </HeaderInfoRow>
    </div>
  )
}

const TokenV1Name = ({ name }: { name: string }) => {
  const nameWrapperAddress = useContractAddress({ contract: 'ensNameWrapper' })
  const registrarAddress = useContractAddress({
    contract: 'ensBaseRegistrarImplementation',
  })

  const {
    data: wrapperData,
    error: isWrappedError,
    isLoading,
  } = useQuery(getWrapperDataQueryOptions({ name }))

  if (isWrappedError)
    return (
      <ErrorMessage
        title="Error loading data"
        description={isWrappedError.cause?.message || isWrappedError.message}
      />
    )

  if (isLoading) return <LoadingMessage />

  const isWrapped = Boolean(wrapperData)

  const contractAddress = isWrapped ? nameWrapperAddress : registrarAddress

  const tokenStandard = isWrapped ? 'ERC-1155' : 'ERC-721'

  const hex = isWrapped ? namehash(name) : labelhash(name.split('.')[0])
  const tokenId = BigInt(hex).toString(10)

  return (
    <TokenInfoCard
      {...{ contractAddress, tokenId, hex, tokenStandard }}
      protocolVersion="ENSv1"
    />
  )
}

const TokenV2Name = ({
  name,
  registryAddress,
}: {
  name: string
  registryAddress: Address
}) => {
  const label = name.split('.')[0]

  const {
    data: tokenId,
    error,
    isLoading,
  } = useQuery(getTokenIdQueryOptions({ label, registryAddress }))

  if (error)
    return (
      <ErrorMessage
        title="Error loading token data"
        description={error.cause?.message || error.message}
      />
    )

  if (isLoading) return <LoadingMessage />

  const hex =
    tokenId != null
      ? (`0x${tokenId.toString(16).padStart(64, '0')}` as Hex)
      : labelhash(label)
  const tokenIdStr =
    tokenId != null
      ? tokenId.toString(10)
      : BigInt(labelhash(label)).toString(10)

  return (
    <TokenInfoCard
      tokenStandard="ERC-1155"
      tokenId={tokenIdStr}
      hex={hex}
      contractAddress={registryAddress}
      protocolVersion="ENSv2"
    />
  )
}

function RouteComponent() {
  const { name } = Route.useParams()

  const { data, isLoading, error } = useQuery(getEnsOwnerQueryOptions({ name }))

  if (error)
    return (
      <ErrorMessage
        compact
        description="Error fetching the owner. Please refresh the page."
      />
    )

  if (isLoading) return <LoadingSpinner title="Loading owner data" />

  const parts = ens_split(name)

  const dnsEncode = dnsEncodeName(name)

  const ascii = asciiEncode(name)

  const hash = namehash(ascii)

  const normalized = isNormalized(name)

  const hasEmoji = Boolean(parts.find((part) => part.emoji))

  const labels = parts.map((label) => String.fromCodePoint(...label.input))

  const encoding = parts.map((part) => part.type).join(' + ')

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-h1">Token Info</h1>
      </header>

      {data?.protocolVersion === 'ENSv1' ? (
        <TokenV1Name name={name} />
      ) : data?.protocolVersion === 'ENSv2' ? (
        <TokenV2Name name={name} registryAddress={data.registryAddress} />
      ) : null}

      <InfoCard
        title="Normalization"
        className="[&_[data-slot=info-card-title]]:px-0 [&_[data-slot=info-row]]:px-0 sm:[&_[data-slot=info-row]]:h-10"
      >
        <InfoRow label="Input">
          <div className="flex flex-row gap-1 flex-wrap items-center">
            {parts.map((label, idx) => (
              <div
                key={String.fromCodePoint(...label.input)}
                className="contents"
              >
                <span className="px-2 py-1 font-mono border border-border rounded">
                  {String.fromCodePoint(...label.input)}
                </span>
                {idx < parts.length - 1 && <span className="mx-0.5">.</span>}
              </div>
            ))}
          </div>
        </InfoRow>

        <InfoRow label="Normalization">
          <div className="flex flex-row gap-2 items-center flex-wrap">
            <span className="font-mono text-sm">
              {hasEmoji ? `${encoding} + Emoji` : encoding}
            </span>
            <div
              className={cn(
                'px-2 py-1 rounded-full flex flex-row items-center gap-1',
                normalized ? 'bg-peridot-100' : 'bg-garnet-100',
              )}
            >
              {normalized ? (
                <CheckCircleIcon className="size-4 text-peridot-500" />
              ) : (
                <XCircleIcon className="size-4 text-garnet-500" />
              )}
              <span
                className={cn(
                  'text-xs font-medium',
                  normalized ? 'text-peridot-900' : 'text-garnet-900',
                )}
              >
                {normalized ? 'Normalized' : 'Not Normalized'}
              </span>
            </div>
          </div>
        </InfoRow>

        <InfoRow label="Unicode">
          <div>
            <EntityBadge
              type="content"
              variant="default"
              copyValue={escapeUnicode(name)}
            >
              <span className="truncate max-w-[30vw] sm:max-w-[670px]">
                {escapeUnicode(name)}
              </span>
            </EntityBadge>
          </div>
        </InfoRow>

        <InfoRow label="ASCII">
          <div>
            <EntityBadge type="content" variant="default" copyValue={ascii}>
              <span className="truncate max-w-[30vw] sm:max-w-[670px]">
                {ascii}
              </span>
            </EntityBadge>
          </div>
        </InfoRow>

        <InfoRow label="DNS encoded">
          <div>
            <EntityBadge type="content" variant="default" copyValue={dnsEncode}>
              <span className="truncate max-w-[30vw] sm:max-w-[670px]">
                {dnsEncode}
              </span>
            </EntityBadge>
          </div>
        </InfoRow>

        <InfoRow label="Namehash">
          <div>
            <EntityBadge type="content" variant="default" copyValue={hash}>
              <span className="truncate max-w-[30vw] sm:max-w-[670px]">
                {hash}
              </span>
            </EntityBadge>
          </div>
        </InfoRow>
      </InfoCard>

      {labels[0] ? (
        <div className="rounded-sm bg-background overflow-hidden [&_[data-slot=info-card-title]]:px-0 [&_[data-slot=info-row]]:px-0 sm:[&_[data-slot=info-row]]:h-10">
          <div className="py-3">
            <span className="text-caps leading-none text-foreground">
              Labels
            </span>
          </div>
          <Tabs defaultValue={labels[0]} className="gap-0">
            <div className="flex items-center gap-2">
              <TabsList>
                {labels.map((label, idx) => (
                  <div key={label} className="contents">
                    <TabsTrigger value={label}>{label}</TabsTrigger>
                    {idx < labels.length - 1 && (
                      <span className="font-medium">.</span>
                    )}
                  </div>
                ))}
              </TabsList>
            </div>
            {parts.map((part) => {
              const label = String.fromCodePoint(...part.input)
              const labelBytes = new TextEncoder().encode(label).length
              const labelChars = [...label].length
              return (
                <TabsContent className="m-0 px-0" value={label} key={label}>
                  <InfoRow label="Input">
                    <div>
                      <EntityBadge
                        type="content"
                        variant="default"
                        copyValue={escapeUnicode(label)}
                      >
                        <span className="truncate max-w-[30vw] sm:max-w-[670px]">
                          {escapeUnicode(label)}
                        </span>
                      </EntityBadge>
                    </div>
                  </InfoRow>

                  <InfoRow label="Normalization">
                    <span className="text-sm ">{part.type as string}</span>
                  </InfoRow>

                  <InfoRow label="Bytes">
                    <div>
                      <EntityBadge
                        type="content"
                        variant="default"
                        copyValue={String(labelBytes)}
                      >
                        <span className="truncate max-w-[30vw] sm:max-w-[670px]">
                          {labelBytes}
                        </span>
                      </EntityBadge>
                    </div>
                  </InfoRow>

                  <InfoRow label="Characters">
                    <div>
                      <EntityBadge
                        type="content"
                        variant="default"
                        copyValue={String(labelChars)}
                      >
                        <span className="truncate max-w-[30vw] sm:max-w-[670px]">
                          {labelChars}
                        </span>
                      </EntityBadge>
                    </div>
                  </InfoRow>

                  <InfoRow label="Labelhash">
                    <div>
                      <EntityBadge
                        type="content"
                        variant="default"
                        copyValue={labelhash(label)}
                      >
                        <span className="truncate max-w-[30vw] sm:max-w-[670px]">
                          {labelhash(label)}
                        </span>
                      </EntityBadge>
                    </div>
                  </InfoRow>
                </TabsContent>
              )
            })}
          </Tabs>
        </div>
      ) : (
        <div className="rounded-sm bg-background p-6">
          Invalid name: no labels
        </div>
      )}
    </div>
  )
}
