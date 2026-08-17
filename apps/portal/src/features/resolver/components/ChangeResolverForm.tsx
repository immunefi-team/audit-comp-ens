import { Link } from '@tanstack/react-router'
import { ArrowLeftIcon, ChevronDown, CircleCheckIcon } from 'lucide-react'
import { ResultAsync } from 'neverthrow'
import { useEffect, useMemo, useRef, useState } from 'react'
import { match } from 'ts-pattern'
import type { Address } from 'viem'
import { isAddress } from 'viem'
import { useConnection } from 'wagmi'
import { ErrorMessage } from '@/components/ErrorMessage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { prepareChangeResolverTransaction } from '@/features/resolver/helpers/changeResolver'
import { useChangeResolver } from '@/features/resolver/hooks/useChangeResolver'
import {
  prepareDeployPermissionedResolverTransaction,
  useDeployPermissionedResolver,
} from '@/features/resolver/hooks/useDeployPermissionedResolver'
import { useUserPermissionedResolvers } from '@/features/resolver/hooks/useUserPermissionedResolvers'
import { getIsSubmitDisabled } from '@/features/resolver/utils/getIsSubmitDisabled'
import { generateResolverSalt } from '@/features/resolver/utils/permissionedResolver'
import { TransactionModal } from '@/features/transaction-manager/components/TransactionModal'
import { useTransactionModal } from '@/features/transaction-manager/hooks/useTransactionModal'

const DEPLOY_RESOLVER_TX_ID = 'tx-deploy-permissioned-resolver'
const CHANGE_RESOLVER_TX_ID = 'tx-change-resolver'

function useAutoSelectFirstResolver(
  deployNewResolver: boolean,
  selectedExistingResolver: string,
  existingResolvers: Address[],
  setSelectedExistingResolver: (value: string) => void,
) {
  useEffect(() => {
    if (deployNewResolver) return
    if (selectedExistingResolver) return
    if (existingResolvers.length === 0) return
    setSelectedExistingResolver(existingResolvers[0])
  }, [
    deployNewResolver,
    selectedExistingResolver,
    existingResolvers,
    setSelectedExistingResolver,
  ])
}

const SUCCESS_LABEL_DURATION_MS = 5000

interface ChangeResolverFormProps {
  readonly name: string
  readonly registryAddress: Address
}

export const ChangeResolverForm = ({
  name,
  registryAddress,
}: ChangeResolverFormProps) => {
  const { address: connectedAddress } = useConnection()
  const [useCustomResolver, setUseCustomResolver] = useState(true)
  const [deployNewResolver, setDeployNewResolver] = useState(true)
  const [resolverAddress, setResolverAddress] = useState('')
  const [selectedExistingResolver, setSelectedExistingResolver] = useState('')
  const [showSuccessButtonLabel, setShowSuccessButtonLabel] = useState(false)
  const deployedResolverAddressRef = useRef<Address | null>(null)

  const {
    openModal: openTransactionModal,
    closeModal: closeTransactionModal,
    clearTransaction,
  } = useTransactionModal()

  const {
    data: existingResolvers = [],
    isLoading: isLoadingExistingResolvers,
    error: existingResolversError,
  } = useUserPermissionedResolvers({
    senderAddress: connectedAddress,
  })

  const {
    changeResolver,
    isPending: isChangeResolverPending,
    hasWallet: hasChangeWallet,
  } = useChangeResolver({
    name,
    registryAddress,
    id: CHANGE_RESOLVER_TX_ID,
  })

  const {
    deployPermissionedResolverAsync,
    deployedResolverAddress,
    isConfirming: isDeployConfirming,
    hasWallet: hasDeployWallet,
  } = useDeployPermissionedResolver({ name })

  const isDeployPath = deployNewResolver && !useCustomResolver

  // A stable throwaway salt for the deploy step's pre-start gas estimate. Deploy
  // gas is independent of the salt value, so this need not match the fresh salt
  // the actual deploy generates — it just needs to be stable across renders so
  // the estimate query doesn't churn.
  const deployResolverSalt = useMemo(() => generateResolverSalt(name), [name])

  useAutoSelectFirstResolver(
    deployNewResolver,
    selectedExistingResolver,
    existingResolvers,
    setSelectedExistingResolver,
  )

  const walletOk = match({ useCustomResolver, deployNewResolver })
    .with({ useCustomResolver: true }, () => hasChangeWallet)
    .with({ deployNewResolver: true }, () => hasDeployWallet)
    .otherwise(() => hasChangeWallet)

  // The resolver the non-deploy path will set: either the custom address the
  // user typed or the existing one they selected. Known at modal-open time, so
  // it can drive the pre-start gas estimate.
  const customResolverToUse = match({ useCustomResolver })
    .with({ useCustomResolver: true }, () =>
      isAddress(resolverAddress) ? (resolverAddress as Address) : null,
    )
    .with({ useCustomResolver: false }, () =>
      isAddress(selectedExistingResolver)
        ? (selectedExistingResolver as Address)
        : null,
    )
    .exhaustive()

  const handleChangeResolverTransactionStart = () => {
    if (!customResolverToUse) {
      return
    }

    changeResolver(customResolverToUse)
  }

  const handleDeployResolverStart = async () => {
    await ResultAsync.fromPromise(
      deployPermissionedResolverAsync({
        id: DEPLOY_RESOLVER_TX_ID,
      }),
      () => undefined,
    ).match(
      (result) => {
        deployedResolverAddressRef.current = result.resolverAddress
      },
      () => undefined,
    )
  }

  const handleChangeResolverAfterDeployStart = () => {
    if (deployedResolverAddressRef.current) {
      changeResolver(deployedResolverAddressRef.current)
      return
    }
    if (deployedResolverAddress) {
      changeResolver(deployedResolverAddress)
    }
  }

  const handleChangeResolverTransactionDone = () => {
    closeTransactionModal()
    clearTransaction()
    setResolverAddress('')
    deployedResolverAddressRef.current = null
    setShowSuccessButtonLabel(true)
    setTimeout(
      () => setShowSuccessButtonLabel(false),
      SUCCESS_LABEL_DURATION_MS,
    )
  }

  const handleSubmit = async () => {
    try {
      if (useCustomResolver) {
        if (!isAddress(resolverAddress)) return
        openTransactionModal()
        return
      }

      if (deployNewResolver) {
        openTransactionModal()
        return
      }

      if (!isAddress(selectedExistingResolver)) return
      openTransactionModal()
    } catch (err) {
      console.error('Failed to update resolver:', err)
    }
  }

  const isSubmitDisabled = getIsSubmitDisabled({
    walletOk,
    useCustomResolver,
    resolverAddress,
    deployNewResolver,
    selectedExistingResolver,
  })

  const buttonText = match({
    isDeployConfirming,
    isChangeResolverPending,
    showSuccessButtonLabel,
  })
    .with({ isDeployConfirming: true }, () => 'Deploying resolver...')
    .with({ isChangeResolverPending: true }, () => 'Changing resolver...')
    .with({ showSuccessButtonLabel: true }, () => 'Resolver changed!')
    .otherwise(() => 'Save changes')

  return (
    <div className="flex flex-col gap-6 p-4 w-full lg:max-w-2xl xl:max-w-5xl mx-auto">
      <Link to="/$name/resolver" params={{ name }}>
        <Button variant="ghost" className="flex items-center gap-2 -ml-2">
          <ArrowLeftIcon className="size-4" />
          Back
        </Button>
      </Link>

      <h1 className="text-h1">Change resolver</h1>

      <div className="flex items-center gap-3">
        <Switch
          checked={useCustomResolver}
          onCheckedChange={setUseCustomResolver}
          id="use-custom-resolver"
        />
        <Label htmlFor="use-custom-resolver" className="cursor-pointer">
          Use custom resolver
        </Label>
      </div>

      {useCustomResolver ? (
        <div className="flex flex-col gap-3">
          <Label
            htmlFor="resolver-address"
            info="Address of the resolver contract to set on this name"
          >
            Contract address
          </Label>
          <Input
            id="resolver-address"
            placeholder="0x..."
            value={resolverAddress}
            onChange={(event) => setResolverAddress(event.target.value)}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <Switch
              checked={deployNewResolver}
              onCheckedChange={setDeployNewResolver}
              id="deploy-new-permissioned-resolver"
            />
            <Label
              htmlFor="deploy-new-permissioned-resolver"
              className="cursor-pointer"
            >
              Deploy new permissioned resolver
            </Label>
          </div>

          {!deployNewResolver && (
            <div className="flex flex-col gap-3">
              <Label htmlFor="existing-permissioned-resolver">
                Existing permissioned resolver
              </Label>
              <div className="relative">
                <select
                  id="existing-permissioned-resolver"
                  value={selectedExistingResolver}
                  onChange={(event) =>
                    setSelectedExistingResolver(event.target.value)
                  }
                  className="h-9 w-full appearance-none rounded-sm border border-input bg-background px-3 pr-8 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={
                    isLoadingExistingResolvers || existingResolvers.length === 0
                  }
                >
                  <option value="">
                    {isLoadingExistingResolvers
                      ? 'Loading resolvers...'
                      : existingResolvers.length > 0
                        ? 'Select a resolver...'
                        : 'No deployed resolvers found'}
                  </option>
                  {existingResolvers.map((address) => (
                    <option key={address} value={address}>
                      {address}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
      )}

      <Button
        onClick={handleSubmit}
        variant="default"
        disabled={isSubmitDisabled}
        className="w-fit"
      >
        <span className="flex items-center gap-2">
          <CircleCheckIcon className="size-4" />
          {buttonText}
        </span>
      </Button>

      {existingResolversError && !deployNewResolver && !useCustomResolver && (
        <ErrorMessage
          compact
          description="Error fetching resolvers. Please refresh the page."
        />
      )}

      <TransactionModal
        transactions={
          isDeployPath
            ? [
                {
                  id: DEPLOY_RESOLVER_TX_ID,
                  title: 'Deploy permissioned resolver',
                  transactionName: `Deploy resolver for ${name}`,
                  intent: {
                    prepare: ({ walletClient, chainId }) =>
                      prepareDeployPermissionedResolverTransaction({
                        from: walletClient.account.address,
                        chainId,
                        salt: deployResolverSalt,
                      }),
                  },
                  onStart: handleDeployResolverStart,
                  onDone: handleChangeResolverAfterDeployStart,
                },
                {
                  id: CHANGE_RESOLVER_TX_ID,
                  title: 'Change resolver',
                  transactionName: `Set resolver for ${name}`,
                  // No pre-start estimate by design: the target is the resolver
                  // deployed by the step above, whose address isn't known until
                  // it mines. Estimated once this step becomes active.
                  onStart: handleChangeResolverAfterDeployStart,
                  onDone: handleChangeResolverTransactionDone,
                },
              ]
            : [
                {
                  id: CHANGE_RESOLVER_TX_ID,
                  title: 'Change resolver',
                  transactionName: `Set resolver for ${name}`,
                  intent: {
                    prepare: customResolverToUse
                      ? ({ walletClient, chainId }) =>
                          prepareChangeResolverTransaction({
                            name,
                            registryAddress,
                            resolverAddress: customResolverToUse,
                            from: walletClient.account.address,
                            chainId,
                          })
                      : undefined,
                  },
                  onStart: handleChangeResolverTransactionStart,
                  onDone: handleChangeResolverTransactionDone,
                },
              ]
        }
      />
    </div>
  )
}
