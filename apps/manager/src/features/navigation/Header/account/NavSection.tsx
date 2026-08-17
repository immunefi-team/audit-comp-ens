import { Trans } from '@lingui/react/macro'
import { Link, type LinkOptions, linkOptions } from '@tanstack/react-router'
import type React from 'react'
import { MSymbol } from '@/components/ui/material-symbol'
import { useConnectedReverseName } from '@/features/wallet/hooks/useConnectedReverseName'
import { tw } from '@/utils/tailwind'

type NavSectionProps = {
  readonly onAction: () => void
}

const getNavItems = (
  reverseName: string | undefined,
): {
  readonly id: string
  readonly icon: React.ReactNode
  readonly label: React.ReactNode
  readonly link: LinkOptions
}[] => [
  {
    id: 'dashboard',
    icon: <MSymbol className="ms-opsz-20" symbol="dashboard" />,
    label: <Trans>Dashboard</Trans>,
    link: linkOptions({
      to: '/dashboard',
    }),
  },
  {
    id: 'profile',
    icon: <MSymbol className="ms-opsz-20" symbol="account_circle" />,
    label: <Trans>Primary Name Profile</Trans>,
    link: linkOptions({
      to: '/$name',
      params: {
        name: reverseName ?? '',
      },
      disabled: !reverseName,
    }),
  },
]

export const NavSection = ({ onAction }: NavSectionProps) => {
  const reverseNameQuery = useConnectedReverseName()
  const navItems = getNavItems(reverseNameQuery.data ?? undefined)

  return (
    <div className="flex flex-col gap-0.5">
      {navItems.map(({ id, icon, label, link }) => (
        <Link
          activeProps={{
            className: tw`bg-ens-quartz-50 font-[450] ms-wght-300`,
          }}
          className="flex items-center gap-2 rounded border-ens-quartz-100 border-b p-3 text-ens-quartz-500 transition-all aria-disabled:cursor-not-allowed aria-disabled:text-ens-quartz-350"
          inactiveProps={{
            className: tw`font-normal not-aria-disabled:hover:bg-ens-quartz-50 not-aria-disabled:hover:font-[450] not-aria-disabled:hover:ms-wght-300`,
          }}
          key={id}
          onClick={() => {
            if (link.disabled) return
            onAction()
          }}
          {...link}
        >
          {icon}
          <span className="text-base">{label}</span>
        </Link>
      ))}
    </div>
  )
}
