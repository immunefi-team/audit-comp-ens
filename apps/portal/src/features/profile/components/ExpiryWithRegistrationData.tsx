import { useQueries, useQuery } from '@tanstack/react-query'
import { CalendarIcon, ClockIcon } from 'lucide-react'
import { useBlock } from 'wagmi'
import { EntityBadge } from '@/components/EntityBadge'
import { ErrorMessage } from '@/components/ErrorMessage'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useBlockExplorerTxUrl } from '@/utils/blockExplorer/useBlockExplorerUrl'
import { formatTimestampDate } from '@/utils/formatting/formatTimestamp'
import { truncateAddress } from '@/utils/formatting/truncateAddress'
import type { ProtocolVersion } from '@/utils/types'
import { useGraceStatus } from '../hooks/useGraceStatus'
import { getNameHistoryQueryOptions } from '../hooks/useNameHistory'
import { getV1ExpiryQueryOptions } from '../hooks/useV1Expiry'
import { getV2NameHistoryQueryOptions } from '../hooks/useV2NameHistory'
import { getV2RegistrationDataQueryOptions } from '../hooks/useV2RegistrationData'
import { InfoRow } from './InfoRow'
import { Timestamp } from './Timestamp'

interface RegistrationDateProps {
  blockNumber: number | bigint
}

const RegistrationDate = ({ blockNumber }: RegistrationDateProps) => {
  const { data, isLoading, error } = useBlock({
    blockNumber: BigInt(blockNumber),
  })

  if (error)
    return (
      <span className="text-p text-message-danger-text">
        Error loading date
      </span>
    )
  if (isLoading) return <LoadingSpinner title="Loading..." />

  if (!data) return null

  return (
    <span className="font-semi-mono">
      <Timestamp timestamp={data.timestamp} />
    </span>
  )
}

type RegistrationDataProps = RegistrationDateProps

const RegistrationData = ({ blockNumber }: RegistrationDataProps) => {
  return (
    <InfoRow icon={CalendarIcon} label="Registered">
      <RegistrationDate blockNumber={blockNumber} />
    </InfoRow>
  )
}

const GraceEndsRow = ({ graceEndDate }: { graceEndDate: Date }) => (
  <InfoRow icon={CalendarIcon} label="Grace ends">
    <Timestamp timestamp={Math.floor(graceEndDate.getTime() / 1000)} />
  </InfoRow>
)

const V1ExpiryWithRegistrationData = ({ name }: { name: string }) => {
  const grace = useGraceStatus({ name, protocolVersion: 'ENSv1' })

  const [nameHistory, expiry] = useQueries({
    queries: [
      getNameHistoryQueryOptions({ name, orderDirection: 'asc', first: 1 }),
      getV1ExpiryQueryOptions({ name }),
    ],
  })

  if (expiry.error)
    return <div>Failed to fetch expiry: {expiry.error.cause.message}</div>
  if (nameHistory.error)
    return (
      <div>Failed to fetch name history: {nameHistory.error.cause.message}</div>
    )

  if (expiry.isLoading || nameHistory.isLoading)
    return <LoadingSpinner title="Loading expiry and registration data" />

  const blockNumber = nameHistory.data?.registrationEvents?.find(
    (event) => event.type === 'NameRegistered',
  )?.blockNumber

  return (
    <>
      {expiry.data && (
        <InfoRow icon={ClockIcon} label="Expires">
          <span className="font-semi-mono">
            <Timestamp timestamp={expiry.data.expiry} />
          </span>
        </InfoRow>
      )}
      {blockNumber && <RegistrationData blockNumber={blockNumber} />}
      {grace.isInGrace && grace.graceEndDate && (
        <GraceEndsRow graceEndDate={grace.graceEndDate} />
      )}
    </>
  )
}

const V2ExpiryWithRegistrationData = ({ name }: { name: string }) => {
  const grace = useGraceStatus({ name, protocolVersion: 'ENSv2' })

  const { data, error, isLoading } = useQuery(
    getV2RegistrationDataQueryOptions({ name }),
  )

  // Ask the indexer for the registration event directly rather than scanning a
  // window of recent history for it. `orderDirection` is applied in SQL before
  // `first` truncates, so `asc` + `first: 1` is genuinely the earliest
  // NameRegistered — a fixed window would miss it on any name with more
  // history than the window.
  const { data: registrationEvents } = useQuery(
    getV2NameHistoryQueryOptions({
      name,
      first: 1,
      orderDirection: 'asc',
      eventTypes: ['NameRegistered'],
    }),
  )

  const registrationTxHash = registrationEvents?.[0]?.transactionHash
  const registrationTxUrl = useBlockExplorerTxUrl(registrationTxHash)

  if (error)
    return (
      <ErrorMessage
        compact
        description="Error fetching registration data. Please refresh the page."
      />
    )

  if (isLoading)
    return <LoadingSpinner title="Loading expiry and registration data" />

  if (!data) return null

  return (
    <>
      {grace.isInGrace && grace.graceEndDate ? (
        <GraceEndsRow graceEndDate={grace.graceEndDate} />
      ) : (
        data.expiry !== null && (
          <InfoRow icon={ClockIcon} label="Expires">
            <div className="font-semi-mono pt-2 pb-3">
              <Timestamp timestamp={data.expiry} />
            </div>
          </InfoRow>
        )
      )}

      {data.registeredAt !== null && (
        <InfoRow icon={CalendarIcon} label="Registered">
          {registrationTxHash ? (
            <EntityBadge
              variant="tx"
              label={formatTimestampDate(data.registeredAt) ?? '—'}
              etherscanHref={registrationTxUrl}
              copyValue={registrationTxHash}
            >
              {truncateAddress(registrationTxHash, 6, 4)}
            </EntityBadge>
          ) : (
            <span className="font-semi-mono">
              <Timestamp timestamp={data.registeredAt} />
            </span>
          )}
        </InfoRow>
      )}
    </>
  )
}

interface ExpiryWithRegistrationDataProps {
  name: string
  protocolVersion: ProtocolVersion
}

export const ExpiryWithRegistrationData = ({
  name,
  protocolVersion,
}: ExpiryWithRegistrationDataProps) => {
  return protocolVersion === 'ENSv1' ? (
    <V1ExpiryWithRegistrationData name={name} />
  ) : (
    <V2ExpiryWithRegistrationData name={name} />
  )
}
