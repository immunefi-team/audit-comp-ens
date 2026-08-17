import { Trans } from '@lingui/react/macro'
import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type PrimaryBadgeProps = {
  label?: ReactNode
  className?: string
}

export const PrimaryBadge = ({ label, className }: PrimaryBadgeProps) => (
  <div
    className={cn(
      'inline-flex items-center gap-2 rounded-[73px] bg-ens-white px-[6.5px] py-[3.3px]',
      className,
    )}
  >
    <span className="font-sans text-[13px] text-ens-blue leading-[1.15] tracking-[-0.24px] md:text-[16px]">
      {label ?? <Trans>Primary Name</Trans>}
    </span>
    <div className="flex size-[13px] items-center justify-center rounded-full bg-ens-blue">
      <Check className="size-2 text-ens-white" strokeWidth={4} />
    </div>
  </div>
)
