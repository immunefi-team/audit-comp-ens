import { Trans } from '@lingui/react/macro'
import { cva } from 'class-variance-authority'
import { CircleAlert } from 'lucide-react'
import ensMarkBadge from '@/assets/ens-mark-badge.svg'

const pillVariants = cva(
  'inline-flex h-5 w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 font-sans text-sm leading-none tracking-[0.28px]',
  {
    variants: {
      tone: {
        eligibleUpgrade: 'bg-ens-garnet-100 text-ens-garnet-500',
        ensv1Only: 'border-[0.5px] border-ens-peridot-500 text-ens-peridot-500',
        owner: 'border-[0.5px] border-ens-peridot-900 text-ens-peridot-900',
        manager: 'border-[0.5px] border-ens-peridot-900 text-ens-peridot-900',
        expiring: 'bg-ens-citrine-50 text-ens-citrine-450',
      },
    },
  },
)

const EnsMark = () => (
  <img alt="" className="size-4 shrink-0" src={ensMarkBadge} />
)

export const EligibleForUpgradePill = () => (
  <span className={pillVariants({ tone: 'eligibleUpgrade' })}>
    <EnsMark />
    <Trans>Eligible for upgrade</Trans>
  </span>
)

export const Ensv1OnlyPill = () => (
  <span className={pillVariants({ tone: 'ensv1Only' })}>
    <EnsMark />
    <Trans>ENSv1 only</Trans>
  </span>
)

export type NameRole = 'owner' | 'manager'

export const RolePill = ({ role }: { readonly role: NameRole }) => (
  <span className={pillVariants({ tone: role })}>
    {role === 'owner' ? <Trans>Owner</Trans> : <Trans>Manager</Trans>}
  </span>
)

export const ExpiringPill = ({ days }: { readonly days: number }) => (
  <span className={pillVariants({ tone: 'expiring' })}>
    <CircleAlert
      className="size-3 shrink-0 text-ens-citrine-500"
      strokeWidth={2}
    />
    <Trans>Expires in {days} days</Trans>
  </span>
)
