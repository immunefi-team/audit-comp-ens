import type { ReactNode } from 'react'

/**
 * History section header per the Builder spec: caps title with an
 * optional "Full history" action on the right.
 */
export const HistorySectionHeader = ({ action }: { action?: ReactNode }) => (
  <div className="flex min-h-7 items-center justify-between gap-4">
    <h2 className="text-caps leading-none text-foreground">History</h2>
    {action}
  </div>
)
