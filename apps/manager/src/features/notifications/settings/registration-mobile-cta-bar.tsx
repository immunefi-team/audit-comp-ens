import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type RegistrationMobileCtaBarProps = {
  children: ReactNode
  className?: string
}

/**
 * On small screens, pins primary/skip actions in a floating pill above the safe
 * area. From `md` up, renders as a normal in-flow row (sibling of the
 * contact-methods card column).
 */
export const RegistrationMobileCtaBar = ({
  children,
  className,
}: RegistrationMobileCtaBarProps) => {
  return (
    <div
      className={cn(
        'max-md:fixed max-md:z-50',
        'max-md:right-4 max-md:bottom-[max(1rem,env(safe-area-inset-bottom))] max-md:left-4',
        'max-md:rounded-xl max-md:border max-md:border-[#ddddde] max-md:bg-white',
        'max-md:p-2 max-md:shadow-[0px_8px_32px_rgba(7,28,47,0.14)]',
        'md:static md:right-auto md:bottom-auto md:left-auto md:z-auto md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none',
        className,
      )}
    >
      <div className="flex w-full flex-row flex-nowrap items-stretch gap-2 md:mx-auto md:max-w-5xl md:flex-wrap md:items-center md:gap-1.5">
        {children}
      </div>
    </div>
  )
}
