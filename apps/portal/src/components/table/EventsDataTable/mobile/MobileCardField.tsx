import type { ReactNode } from 'react'

interface MobileCardFieldProps {
  label: string
  children: ReactNode
}

export const MobileCardField = ({ label, children }: MobileCardFieldProps) => {
  return (
    <>
      <div className="text-sm font-medium">{label}</div>
      <div className="text-base">{children}</div>
    </>
  )
}
