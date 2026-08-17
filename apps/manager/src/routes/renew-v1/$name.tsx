import {
  createFileRoute,
  type ErrorComponentProps,
  redirect,
} from '@tanstack/react-router'
import { profileExpiryQuery } from '@/features/profile/service/profileExpiry'
import { profileOwnerQuery } from '@/features/profile/service/profileOwner'
import { getV1RenewableQueryOptions } from '@/features/renew/data/queries/v1Renewable.query'
import { parseRenewableName } from '@/features/renew/utils/renewableName'
import { RenewalRouteError } from '@/features/renew/workflow/components/RenewalRouteError'
import { RenewalPage } from '@/features/renew/workflow/RenewalPage'

export const Route = createFileRoute('/renew-v1/$name')({
  loader: async ({ params: { name }, context: { queryClient } }) => {
    const parsedName = parseRenewableName(name)

    if (parsedName.isErr()) {
      throw parsedName.error
    }

    const ownerData = await queryClient.ensureQueryData(profileOwnerQuery(name))

    if (ownerData?.protocol === 'v2') {
      throw redirect({
        params: { name },
        to: '/renew/$name',
        replace: true,
      })
    }

    if (ownerData?.protocol !== 'v1') {
      throw new Error('This ENSv1 name is not reserved or registered.')
    }

    const [expiryData, isRenewable] = await Promise.all([
      queryClient.ensureQueryData(profileExpiryQuery(name, 'v1')),
      queryClient.ensureQueryData(getV1RenewableQueryOptions(name)),
    ])

    if (!isRenewable) {
      throw new Error(
        'This ENSv1 name is migrated, unreserved, or outside its renewal window.',
      )
    }

    if (!expiryData?.expiry) {
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
    <RenewalPage currentExpiry={currentExpiry} label={label} protocol="v1" />
  )
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const { name } = Route.useParams()
  return <RenewalRouteError error={error} name={name} reset={reset} />
}
