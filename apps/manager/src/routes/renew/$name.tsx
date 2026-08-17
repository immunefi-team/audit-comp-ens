import {
  createFileRoute,
  type ErrorComponentProps,
  redirect,
} from '@tanstack/react-router'
import { isPastGracePeriod } from '@/features/grace/utils/gracePeriod'
import {
  profileExpiryDateFromSeconds,
  profileExpiryQuery,
} from '@/features/profile/service/profileExpiry'
import {
  canRenewV2Name,
  parseRenewableName,
} from '@/features/renew/utils/renewableName'
import { RenewalRouteError } from '@/features/renew/workflow/components/RenewalRouteError'
import { RenewalPage } from '@/features/renew/workflow/RenewalPage'

export const Route = createFileRoute('/renew/$name')({
  loader: async ({ params: { name }, context: { queryClient } }) => {
    const parsedName = parseRenewableName(name)

    if (parsedName.isErr()) {
      throw parsedName.error
    }

    const expiryData = await queryClient.ensureQueryData(
      profileExpiryQuery(name),
    )

    if (expiryData?.protocol === 'v1') {
      throw redirect({
        params: { name },
        to: '/renew-v1/$name',
        replace: true,
      })
    }

    const expiryDate = profileExpiryDateFromSeconds(expiryData?.expiry)

    if (expiryData?.protocol !== 'v2') {
      throw new Error('This name is not available for renewal.')
    }

    if (isPastGracePeriod(expiryDate, expiryData.protocol)) {
      throw redirect({
        params: { name },
        to: '/register/$name',
        replace: true,
      })
    }

    if (!canRenewV2Name(name, expiryDate)) {
      throw new Error('This name is not available for renewal.')
    }

    if (!expiryData.expiry) {
      throw new Error('Name expiry could not be loaded.')
    }

    return {
      label: parsedName.value.label,
      currentExpiry: expiryData.expiry,
    }
  },
  component: RouteComponent,
  errorComponent: ErrorComponent,
})

function RouteComponent() {
  const { label, currentExpiry } = Route.useLoaderData()
  return (
    <RenewalPage currentExpiry={currentExpiry} label={label} protocol="v2" />
  )
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const { name } = Route.useParams()
  return <RenewalRouteError error={error} name={name} reset={reset} />
}
