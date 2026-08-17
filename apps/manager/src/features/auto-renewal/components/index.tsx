import { Plural, Trans } from '@lingui/react/macro'
import { Calendar, CircleAlert } from 'lucide-react'
import { Highlight } from '@/components/atoms/Highlight'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { TIME_UNITS } from '@/utils/time'
import type { AutoRenewal } from '../MOCKS'

type ExpiryStatus = 'expired' | 'expires-very-soon' | 'expires-soon' | 'active'

const getExpiryStatus = (expires: number): ExpiryStatus => {
  const now = Date.now()
  const diff = expires - now
  if (diff < 0) return 'expired'
  if (diff < TIME_UNITS.DAY * 16) return 'expires-very-soon'
  if (diff < TIME_UNITS.DAY * 30) return 'expires-soon'
  return 'active'
}

const statusText = {
  expired: {
    text: 'Expired',
    variant: 'red',
  },
  'expires-very-soon': {
    text: 'Upcoming Renewal',
    variant: 'red',
  },
  'expires-soon': {
    text: 'Upcoming Renewal',
    variant: 'outline',
  },
  active: {
    text: 'Active',
    variant: 'gray',
  },
} as const

export const AutoRenewalItem = ({
  autoRenewal,
}: {
  autoRenewal: AutoRenewal
}) => {
  const status = getExpiryStatus(autoRenewal.expires)

  return (
    <div className="space-y-2 rounded-md border border-gray-200 px-3 py-6">
      <div className="flex justify-between">
        <Highlight>{autoRenewal.name}</Highlight>
        <Badge variant={statusText[status].variant}>
          {statusText[status].text}
        </Badge>
      </div>
      <div className="flex items-center gap-1">
        <Calendar className="size-3 text-gray-500" />
        <span className="text-gray-500 text-sm">
          <Trans>Expires:</Trans>
        </span>
        <span className="text-sm">
          {new Date(autoRenewal.expires).toLocaleDateString()}
        </span>
      </div>
      {autoRenewal.expires - Date.now() < TIME_UNITS.DAY * 16 && (
        <div className="text-red-600 text-sm">
          <Plural
            one="# day remaining"
            other="# days remaining"
            value={Math.floor(
              (autoRenewal.expires - Date.now()) / TIME_UNITS.DAY,
            )}
          />
        </div>
      )}
      <div className="flex justify-end">
        <span className="text-gray-500 text-sm">
          <Trans>{autoRenewal.price} USD/year</Trans>
        </span>
      </div>
      <div className="flex items-center justify-end gap-1">
        <span className="text-gray-500 text-sm">
          <Trans>Autorenews on</Trans>
        </span>
        <span className="text-sm">
          {new Date(autoRenewal.expires - TIME_UNITS.DAY).toLocaleDateString()}
        </span>
        <Switch defaultChecked />
      </div>
    </div>
  )
}

export const NonAutoRenewalWarning = ({
  nonAutoRenewals,
}: {
  nonAutoRenewals: AutoRenewal[]
}) => {
  if (nonAutoRenewals.length === 0) return null
  return (
    <div className="flex gap-4 rounded-md bg-gray-200 p-4">
      <CircleAlert className="size-8" />
      <div className="text-gray-500">
        <div className="font-medium">
          <Plural
            one="# ENS name is expiring without auto-renewal"
            other="# ENS names are expiring without auto-renewal"
            value={nonAutoRenewals.length}
          />
        </div>
        <div className="text-gray-500 text-sm">
          {/* "erni.eth expires on July 10, 2025. Enable autorenewal or renew manually to avoid expiration." if only one name */}
          {nonAutoRenewals.length === 1 && nonAutoRenewals[0] ? (
            <Trans>
              {nonAutoRenewals[0].name} expires on{' '}
              <span className="font-medium">
                {new Date(nonAutoRenewals[0].expires).toLocaleDateString()}
              </span>
              . Enable auto-renewal or renew manually to avoid expiration.
            </Trans>
          ) : nonAutoRenewals[0] ? (
            <Trans>
              {nonAutoRenewals.join(', ')} are expiring without auto-renewal
              with the earliest expiring on{' '}
              <span className="font-medium">
                {new Date(nonAutoRenewals[0].expires).toLocaleDateString()}
              </span>
              . Enable auto-renewal or renew manually to avoid expiration.
            </Trans>
          ) : null}
        </div>
      </div>
    </div>
  )
}
