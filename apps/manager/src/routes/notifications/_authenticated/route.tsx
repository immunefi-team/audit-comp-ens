import { createFileRoute, Outlet } from '@tanstack/react-router'
import { RequireBackendAuth } from '@/features/notifications/RequireBackendAuth'

export const Route = createFileRoute('/notifications/_authenticated')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <RequireBackendAuth>
      <Outlet />
    </RequireBackendAuth>
  )
}
