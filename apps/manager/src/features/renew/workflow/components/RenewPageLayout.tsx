import type { ReactNode } from 'react'

export const RenewPageLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="mx-auto mt-12 mb-4 w-full-[32px] max-w-6xl space-y-6.5">
      {children}
    </div>
  )
}
