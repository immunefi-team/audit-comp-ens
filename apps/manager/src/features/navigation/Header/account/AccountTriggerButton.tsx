import type { ButtonHTMLAttributes } from 'react'
import { tw } from '@/utils/tailwind'
import { UnreadDot } from '../notifications/UnreadBadge'
import { AccountTriggerContent } from './AccountTriggerContent'

export const AccountTriggerButton = ({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) => {
  return (
    <button
      className={tw('group relative flex items-center gap-2', className)}
      type="button"
      {...props}
    >
      <AccountTriggerContent />
      <UnreadDot className="-ml-2 self-start" />
    </button>
  )
}
