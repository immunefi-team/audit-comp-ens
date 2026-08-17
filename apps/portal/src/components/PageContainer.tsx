import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Centers page content, caps it at 1440px (`max-w-360`), and applies the
 * shared page frame from the Builder layout spec (WEB-595): 40px padding
 * with a 32px gap between sections (16px padding on mobile).
 *
 * Applied once per layout around the page `Outlet` so every route shares the
 * same frame without each page repeating the wrapper. Placed inside
 * `SidebarInset` so the inset background, mobile header and banners stay
 * full-bleed while only the content is constrained.
 */
export function PageContainer({
  children,
  className,
}: {
  readonly children: ReactNode
  readonly className?: string
}) {
  return (
    <div
      className={cn(
        'w-full max-w-360 mx-auto p-4 lg:p-10 flex flex-col gap-8',
        className,
      )}
    >
      {children}
    </div>
  )
}
