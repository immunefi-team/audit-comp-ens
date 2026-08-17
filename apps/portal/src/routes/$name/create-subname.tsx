import { isTimeTravelEnabled } from '@ens-apps/dev-time-travel'
import { getResolver } from '@ensdomains/ensjs/public'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeftIcon, Loader2 } from 'lucide-react'
import { ResultAsync } from 'neverthrow'
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { match, P } from 'ts-pattern'
import { type Address, zeroAddress } from 'viem'
import { useConnection } from 'wagmi'
import { ErrorMessage } from '@/components/ErrorMessage'
import { LoadingMessage } from '@/components/LoadingMessage'
import { NotFoundMessage } from '@/components/NotFoundMessage'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { AddressNameInput } from '@/features/address/components/AddressNameInput'
import { useAddressResolution } from '@/features/address/hooks/useAddressResolution'
import {
  type GetEnsOwnerReturnType,
  getEnsOwnerQueryOptions,
} from '@/features/profile/hooks/useEnsOwner'
import { getSubnamesQueryOptions } from '@/features/profile/hooks/useSubnames'
import { useCreateSubname } from '@/features/registry/hooks/useCreateSubname'
import { getNameRegistriesQueryOptions } from '@/features/registry/hooks/useNameRegistryDiscovery'
import { prepareCreateSubnameTransaction } from '@/features/registry/utils/create-subname.helpers'
import { TransactionModal } from '@/features/transaction-manager/components/TransactionModal'
import { useTransactionModal } from '@/features/transaction-manager/hooks/useTransactionModal'
import { safeGetClient } from '@/lib/wagmi/helpers'
import { getLabelRegistrationError } from '@/utils/token/isNormalized'
import type { ProtocolVersion } from '@/utils/types'

export const Route = createFileRoute('/$name/create-subname')({
  component: RouteComponent,
  notFoundComponent: () => <NotFoundMessage />,
})

// --- Page Header (shared across states) ---

interface PageHeaderProps {
  readonly name: string
}

const PageHeader = ({ name }: PageHeaderProps) => (
  <div className="flex flex-col gap-2">
    <Link to="/$name/subnames" params={{ name }}>
      <Button
        variant="ghost"
        className="flex items-center gap-1 -ml-2 text-muted-foreground"
      >
        <ArrowLeftIcon className="size-6" />
        Back
      </Button>
    </Link>
    <h1 className="text-h1">Create subname</h1>
  </div>
)

function useSyncOwnerWithConnectedAddress(
  connectedAddress: Address | undefined,
  hasUserEdited: React.RefObject<boolean>,
  setOwnerInput: (value: string) => void,
) {
  useEffect(() => {
    if (connectedAddress && !hasUserEdited.current) {
      setOwnerInput(connectedAddress)
    }
  }, [connectedAddress, hasUserEdited, setOwnerInput])
}

interface CreateSubnameFormProps {
  readonly name: string
  readonly protocolVersion: ProtocolVersion
}

const CREATE_SUBNAME_TRANSACTION_ID = 'tx-create-ens-subname'

// One-year (in seconds) default expiry, matching ensjs'
// `createSubnameV2WriteParameters` default. When time-travel is active Anvil's
// block time can be far ahead of `Date.now()`, so use a 100-year window to
// ensure the expiry is never stale on-chain.
const ONE_YEAR_SECONDS = 31536000n
const HUNDRED_YEARS_SECONDS = 3153600000n

const computeSubnameExpires = (): bigint => {
  const nowSeconds = BigInt(Math.floor(Date.now() / 1000))
  return isTimeTravelEnabled()
    ? nowSeconds + HUNDRED_YEARS_SECONDS
    : nowSeconds + ONE_YEAR_SECONDS
}

const CreateSubnameForm = ({
  name,
  protocolVersion,
}: CreateSubnameFormProps) => {
  const navigate = useNavigate()
  const { address: connectedAddress, isConnected } = useConnection()

  const [label, setLabel] = useState('')
  const [ownerInput, setOwnerInput] = useState(connectedAddress ?? '')
  const [prepareError, setPrepareError] = useState<string | null>(null)
  const [resolverAddress, setResolverAddress] = useState<Address | null>(null)
  // A stable expiry for the pre-start gas estimate. Gas is independent of the
  // expiry value, so this need not match the fresh one the submit computes — it
  // just has to be stable across renders so the estimate query doesn't churn.
  const estimateExpires = useMemo(() => computeSubnameExpires(), [])
  const hasUserEditedOwner = useRef(false)

  const ownerResolution = useAddressResolution(ownerInput)
  const ownerAddress = ownerResolution.address
  const ownerInvalid =
    ownerResolution.status === 'invalid' ||
    ownerResolution.status === 'unresolved' ||
    ownerResolution.status === 'error'

  useSyncOwnerWithConnectedAddress(
    connectedAddress,
    hasUserEditedOwner,
    setOwnerInput,
  )

  const {
    openModal: openTransactionModal,
    closeModal: closeTransactionModal,
    clearTransaction,
  } = useTransactionModal()

  const {
    createSubname,
    isPending: isSubmitting,
    isSuccess,
  } = useCreateSubname()

  // Fetch registries (we know it's v2 at this point)
  const {
    data: registriesData,
    isLoading: registriesLoading,
    error: registriesError,
  } = useQuery(getNameRegistriesQueryOptions({ name }))

  const subregistryAddress = registriesData?.[0]
  const hasSubregistry =
    subregistryAddress && subregistryAddress !== zeroAddress

  const { data: existingSubnames } = useQuery({
    ...getSubnamesQueryOptions({ name, protocolVersion: 'ENSv2' }),
    enabled: Boolean(hasSubregistry),
  })

  const trimmedLabel = label.trim()
  const labelError = getLabelRegistrationError(trimmedLabel)
  const isLabelTaken = Boolean(
    trimmedLabel && existingSubnames?.some((s) => s.labelName === trimmedLabel),
  )

  const handleStartTransaction = () => {
    if (!hasSubregistry || !ownerAddress || !resolverAddress || labelError) {
      return
    }

    createSubname({
      registryAddress: subregistryAddress,
      label: label.trim(),
      owner: ownerAddress,
      resolverAddress,
      parentName: name,
      protocolVersion,
      id: CREATE_SUBNAME_TRANSACTION_ID,
      expires: computeSubnameExpires(),
    })
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!e.currentTarget.reportValidity()) {
      return
    }

    if (!hasSubregistry || !ownerAddress) {
      return
    }

    setPrepareError(null)

    const clientResult = safeGetClient()
    if (clientResult.isErr()) {
      setPrepareError('Failed to get client')
      return
    }

    const resolverResult = await ResultAsync.fromPromise(
      getResolver(clientResult.value, { name }),
      () => new Error('Failed to get resolver'),
    )

    if (resolverResult.isErr()) {
      setPrepareError(resolverResult.error.message)
      return
    }

    if (!resolverResult.value) {
      setPrepareError('No resolver found for parent name')
      return
    }

    setResolverAddress(resolverResult.value)
    openTransactionModal()
  }

  if (registriesLoading) {
    return <LoadingMessage />
  }

  if (registriesError) {
    return (
      <ErrorMessage
        title="Failed to load registry data"
        description={registriesError.cause?.message || registriesError.message}
      />
    )
  }

  if (!hasSubregistry) {
    return (
      <div className="flex flex-col gap-6 w-full max-w-[640px] mx-auto">
        <PageHeader name={name} />
        <p className="text-muted-foreground">
          This name does not have a subregistry. You must deploy one first to
          create subnames.
        </p>
        <Button asChild variant="default" className="w-fit">
          <Link to="/$name/registry" params={{ name }}>
            Deploy subregistry
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-[640px] mx-auto">
      <PageHeader name={name} />

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Field data-invalid={isLabelTaken || Boolean(labelError)}>
          <FieldLabel htmlFor="label">Subname</FieldLabel>
          <div className="flex items-center gap-2">
            <Input
              id="label"
              name="label"
              placeholder="subname"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="flex-1"
              disabled={isSubmitting || isSuccess}
              required
            />
            <span className="text-base">.{name}</span>
          </div>
          {isLabelTaken && (
            <p className="text-sm text-danger">
              {trimmedLabel}.{name} is already registered.
            </p>
          )}
          {labelError && <p className="text-sm text-danger">{labelError}</p>}
        </Field>

        <Field data-invalid={ownerInvalid}>
          <FieldLabel htmlFor="owner">Owner</FieldLabel>
          <AddressNameInput
            id="owner"
            name="owner"
            placeholder="ENS name or HEX address"
            required
            disabled={isSubmitting || isSuccess}
            value={ownerInput}
            onChange={(value) => {
              hasUserEditedOwner.current = true
              setOwnerInput(value)
            }}
            resolution={ownerResolution}
          />
        </Field>

        {match({ isConnected, prepareError })
          .with({ isConnected: false }, () => (
            <p className="text-sm text-warning">
              Please connect your wallet to create a subname.
            </p>
          ))
          .with({ prepareError: P.string.minLength(1) }, ({ prepareError }) => (
            <p className="text-sm text-danger">Error: {prepareError}</p>
          ))
          .otherwise(() => null)}

        <Button
          type="submit"
          disabled={
            !ownerAddress || !isConnected || isLabelTaken || Boolean(labelError)
          }
          className="w-full sm:w-fit"
        >
          {match({ isSubmitting, isSuccess })
            .with({ isSubmitting: true }, () => (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Creating...
              </>
            ))
            .with({ isSuccess: true }, () => 'Transaction Complete')
            .otherwise(() => 'Create subname')}
        </Button>
      </form>

      <TransactionModal
        transactions={[
          {
            id: CREATE_SUBNAME_TRANSACTION_ID,
            title: 'Create subname',
            transactionName: `Create ${label.trim()}.${name}`,
            // The prepared createSubname transaction for the pre-start gas
            // estimate. Undefined until the form is ready (resolver resolved,
            // owner set) — the modal shows "Estimating…" until then.
            intent: {
              prepare:
                hasSubregistry && ownerAddress && resolverAddress
                  ? ({ walletClient, chainId }) =>
                      prepareCreateSubnameTransaction({
                        registryAddress: subregistryAddress,
                        label: label.trim(),
                        owner: ownerAddress,
                        resolverAddress,
                        walletClient,
                        chainId,
                        expires: estimateExpires,
                      })
                  : undefined,
            },
            onStart: handleStartTransaction,
            onDone: () => {
              closeTransactionModal()
              clearTransaction()
              navigate({ to: '/$name/subnames', params: { name } })
            },
          },
        ]}
      />
    </div>
  )
}

// --- Content Component (fetches ownerData, renders form for v2) ---

interface CreateSubnameContentProps {
  readonly name: string
  readonly ownerData: NonNullable<GetEnsOwnerReturnType>
}

const CreateSubnameContent = ({
  name,
  ownerData,
}: CreateSubnameContentProps) => {
  if (ownerData.protocolVersion !== 'ENSv2') {
    return (
      <div className="flex flex-col gap-6 w-full max-w-[640px] mx-auto">
        <PageHeader name={name} />
        <p className="text-muted-foreground">
          This feature is only available for ENSv2 names.
        </p>
      </div>
    )
  }

  return (
    <CreateSubnameForm
      name={name}
      protocolVersion={ownerData.protocolVersion}
    />
  )
}

// --- Route Component (fetches ownerData) ---

function RouteComponent() {
  const { name } = Route.useParams()

  const {
    data: ownerData,
    isLoading,
    error,
  } = useQuery(getEnsOwnerQueryOptions({ name }))

  if (isLoading) {
    return <LoadingMessage />
  }

  if (error) {
    return (
      <ErrorMessage
        title="Failed to load name data"
        description={error.cause?.message || error.message}
      />
    )
  }

  if (!ownerData) {
    return <NotFoundMessage />
  }

  return <CreateSubnameContent name={name} ownerData={ownerData} />
}
