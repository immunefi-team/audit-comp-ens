import type { ReactNode } from 'react'
import { DevDrawer } from './DevDrawer'

type DevDrawerShellProps = {
  readonly enabled: boolean
  readonly children: ReactNode
}

/** Renders app content and mounts the fixed DevDrawer trigger when enabled. */
export function DevDrawerShell({ enabled, children }: DevDrawerShellProps) {
  return (
    <>
      {children}
      {enabled ? <DevDrawer /> : null}
    </>
  )
}
