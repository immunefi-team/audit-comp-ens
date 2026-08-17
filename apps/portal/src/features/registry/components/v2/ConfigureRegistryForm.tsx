import { getChainContractAddress } from '@ensdomains/ensjs/chain'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { ResultAsync } from 'neverthrow'
import { useRef, useState } from 'react'
import { match } from 'ts-pattern'
import { type Address, isAddress, zeroAddress } from 'viem'
import { useConnection } from 'wagmi'
import { ErrorMessage } from '@/components/ErrorMessage'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { prepareDeploySubregistryTransaction } from '@/features/registry/helpers/deploySubregistry'
import { prepareSetSubregistryTransaction } from '@/features/registry/helpers/setSubregistry'
import { useDeploySubregistry } from '@/features/registry/hooks/useDeploySubregistry'
import { getHasRolesQueryOptions } from '@/features/registry/hooks/useHasRoles'
import { getNameRegistriesQueryOptions } from '@/features/registry/hooks/useNameRegistryDiscovery'
import { useSetSubregistry } from '@/features/registry/hooks/useSetSubregistry'
import { TransactionModal } from '@/features/transaction-manager/components/TransactionModal'
import { useTransactionModal } from '@/features/transaction-manager/hooks/useTransactionModal'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { sepoliaWithEns } from '@/lib/wagmi'
import { verifyProxyContract } from '@/utils/blockExplorer/verifyProxyContract'

const DEPLOY_SUBREGISTRY_TX_ID = 'tx-deploy-subregistry'
const SET_SUBREGISTRY_TX_ID = 'tx-set-subregistry'

const SUCCESS_LABEL_DURATION_MS = 5000

const factoryAddress = getChainContractAddress({
  chain: sepoliaWithEns,
  contract: 'ensVerifiableFactory',
})

const implAddress = getChainContractAddress({
  chain: sepoliaWithEns,
  contract: 'ensUserRegistryImpl',
})

type RegistryOption = 'deploy' | 'use-existing'

type ConfigureRegistryFormProps = {
  name: string
}

const NoRegistryConfiguredCard = ({ name }: { name: string }) => (
  <div className="flex flex-col gap-4 bg-neutral-2 p-6 rounded-[8px]">
    <h3 className="text-3xl font-normal leading-none tracking-[-0.02em] font-serif">
      No registry configured
    </h3>
    <p className="text-p">
      This name doesn't have a contract set to create and manage subnames.
      Create one to turn <strong>{name}</strong> into its own namespace with
      subnames like <strong>cold.{name}</strong> or{' '}
      <strong>agent.{name}</strong>.
    </p>
  </div>
)

export function ConfigureRegistryForm({ name }: ConfigureRegistryFormProps) {
  const isMobile = useIsMobile()
  const { address: connectedAddress } = useConnection()

  const [registryOption, setRegistryOption] = useState<RegistryOption>('deploy')
  const [contractAddress, setContractAddress] = useState('')

  const useCustomRegistry = registryOption === 'use-existing'
  const [showSuccessButtonLabel, setShowSuccessButtonLabel] = useState(false)
  const deployedSubregistryAddressRef = useRef<Address | null>(null)

  const [showDeploySubregistryForm, setShowDeploySubregistryForm] =
    useState(false)

  const {
    openModal: openTransactionModal,
    closeModal: closeTransactionModal,
    clearTransaction,
  } = useTransactionModal()

  const {
    data: registries,
    isLoading,
    error,
  } = useQuery(getNameRegistriesQueryOptions({ name }))

  const label = name.split('.')[0]
  const parentRegistry = registries?.at(1) ?? null

  const { data: hasSetSubregistryRole, isLoading: isLoadingRoleCheck } =
    useQuery({
      ...getHasRolesQueryOptions({
        registryAddress: parentRegistry ?? zeroAddress,
        label,
        roles: ['ROLE_SET_SUBREGISTRY'],
        account: connectedAddress ?? zeroAddress,
      }),
      enabled: !!connectedAddress && !!parentRegistry && !isLoading,
    })

  const customSubregistryAddress =
    useCustomRegistry && isAddress(contractAddress)
      ? (contractAddress as Address)
      : null

  const isDeployPath = !customSubregistryAddress

  const {
    deploySubregistryAsync,
    isConfirming: isDeployConfirming,
    hasWallet: hasDeployWallet,
  } = useDeploySubregistry({
    name,
    factoryAddress,
    implAddress,
  })

  const {
    setSubregistry,
    isPending: isSetSubregistryPending,
    isSuccess: isSetSubregistrySuccess,
    hasWallet: hasSetWallet,
  } = useSetSubregistry({
    name,
    label,
    parentRegistry: parentRegistry ?? zeroAddress,
    id: SET_SUBREGISTRY_TX_ID,
  })

  const walletOk = isDeployPath ? hasDeployWallet : hasSetWallet

  // `Transaction.onStart` is `() => void`, so this Promise is never awaited by
  // the modal or `useAutoAdvanceTransaction`. That is intentional: failures are
  // handled inside `ResultAsync.fromPromise` so nothing rejects unhandled.
  const handleDeploySubregistryStart = async () => {
    await ResultAsync.fromPromise(
      deploySubregistryAsync({ id: DEPLOY_SUBREGISTRY_TX_ID }),
      () => undefined,
    ).match(
      (result) => {
        deployedSubregistryAddressRef.current = result.deployedAddress
        // Fire-and-forget: ask Etherscan to link this proxy to its already
        // source-verified implementation so Read/Write-as-Proxy works. Never
        // awaited — must not block or fail the deploy flow.
        void verifyProxyContract(sepoliaWithEns, result.deployedAddress)
      },
      () => undefined,
    )
  }

  const handleSetSubregistryAfterDeployStart = () => {
    const deployed = deployedSubregistryAddressRef.current
    if (!deployed) return
    // Both the deploy step's `onDone` (fired automatically on success by
    // `useAutoAdvanceTransaction`) and the set step's `onStart` route here, so
    // guard against resubmitting while a set is already in flight or done. An
    // errored set leaves both flags false, so "Try again" still works.
    if (isSetSubregistryPending || isSetSubregistrySuccess) return
    setSubregistry(deployed)
  }

  const handleSetSubregistryStart = () => {
    if (!customSubregistryAddress) return
    setSubregistry(customSubregistryAddress)
  }

  const handleSetSubregistryDone = () => {
    closeTransactionModal()
    clearTransaction()
    setContractAddress('')
    setRegistryOption('deploy')
    deployedSubregistryAddressRef.current = null
    setShowSuccessButtonLabel(true)
    setTimeout(
      () => setShowSuccessButtonLabel(false),
      SUCCESS_LABEL_DURATION_MS,
    )
  }

  const handleSubmit = () => {
    if (useCustomRegistry && !isAddress(contractAddress)) return
    openTransactionModal()
  }

  const isSubmitDisabled =
    (useCustomRegistry && !isAddress(contractAddress)) || !walletOk

  const buttonText = match({
    isDeployConfirming,
    isSetSubregistryPending,
    showSuccessButtonLabel,
  })
    .with({ isDeployConfirming: true }, () => 'Deploying...')
    .with({ isSetSubregistryPending: true }, () => 'Setting subregistry...')
    .with({ showSuccessButtonLabel: true }, () => 'Complete!')
    .otherwise(() => 'Deploy subregistry')

  if (isLoading) {
    return <LoadingSpinner title="Loading registry information" />
  }

  if (error) {
    return (
      <ErrorMessage
        compact
        description="Error fetching registry data. Please refresh the page."
      />
    )
  }

  if (!parentRegistry || parentRegistry === zeroAddress) return null

  if (isLoadingRoleCheck) {
    return <LoadingSpinner title="Checking permissions..." />
  }

  if (!connectedAddress) {
    return (
      <ErrorMessage
        title="Wallet Not Connected"
        description="Please connect your wallet to deploy or change a registry."
      />
    )
  }

  const wrapperClassName = cn(
    'flex flex-col gap-4 max-w-xl',
    isMobile ? 'pl-0 pt-3' : 'pl-14',
  )

  if (!hasSetSubregistryRole) {
    return (
      <div className={wrapperClassName}>
        <NoRegistryConfiguredCard name={name} />
        <div className="flex flex-col gap-2">
          <Button className="w-full" variant="default" disabled>
            <Plus className="size-3" />
            Configure registry
          </Button>
          <p className="text-sm text-muted-foreground">
            You need the{' '}
            <strong className="text-foreground">Set Subregistry</strong> role to
            configure this registry. Ask an admin to grant it.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={wrapperClassName}>
      <NoRegistryConfiguredCard name={name} />
      {showDeploySubregistryForm ? (
        <form
          className="flex flex-col gap-5 border border-border rounded-lg p-5"
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
        >
          <RadioGroup
            value={registryOption}
            onValueChange={(value) =>
              setRegistryOption(value as RegistryOption)
            }
          >
            <div className="flex items-center gap-3">
              <RadioGroupItem value="deploy" id="registry-option-deploy" />
              <Label
                htmlFor="registry-option-deploy"
                className="cursor-pointer text-foreground"
              >
                Deploy a new Permissioned Registry contract
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <RadioGroupItem
                value="use-existing"
                id="registry-option-use-existing"
              />
              <Label
                htmlFor="registry-option-use-existing"
                className="cursor-pointer text-foreground"
              >
                Use a pre-existing registry contract
              </Label>
            </div>
          </RadioGroup>
          {useCustomRegistry && (
            <div className="flex flex-col gap-3">
              <Input
                id="contract-address"
                placeholder="Paste contract address"
                value={contractAddress}
                className="w-full p-3 h-9 bg-background border border-border rounded-md"
                onChange={(e) => setContractAddress(e.target.value)}
              />
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant="outline"
              className="col-span-1"
              onClick={() => setShowDeploySubregistryForm(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              className="col-span-2"
              disabled={isSubmitDisabled}
            >
              <span className="flex items-center gap-2">{buttonText}</span>
            </Button>
          </div>
        </form>
      ) : (
        <Button
          className="w-full"
          variant="default"
          onClick={() => setShowDeploySubregistryForm(true)}
        >
          <Plus className="size-3" />
          Configure registry
        </Button>
      )}

      <TransactionModal
        transactions={
          isDeployPath
            ? [
                {
                  id: DEPLOY_SUBREGISTRY_TX_ID,
                  title: 'Deploy subregistry',
                  transactionName: `Deploy subregistry for ${name}`,
                  intent: {
                    prepare: ({ walletClient, chainId }) =>
                      prepareDeploySubregistryTransaction({
                        factoryAddress,
                        implAddress,
                        walletClient,
                        chainId,
                      }),
                  },
                  onStart: handleDeploySubregistryStart,
                  // Chains into the set step once the deploy succeeds; the
                  // handler is idempotent so this can't double-submit.
                  onDone: handleSetSubregistryAfterDeployStart,
                },
                {
                  id: SET_SUBREGISTRY_TX_ID,
                  title: 'Set subregistry',
                  transactionName: `Set subregistry for ${name}`,
                  // No pre-start estimate by design: the target is the subregistry
                  // deployed by the step above, whose address isn't known until
                  // it mines. Estimated once this step becomes active.
                  onStart: handleSetSubregistryAfterDeployStart,
                  onDone: handleSetSubregistryDone,
                },
              ]
            : [
                {
                  id: SET_SUBREGISTRY_TX_ID,
                  title: 'Set subregistry',
                  transactionName: `Set custom subregistry for ${name}`,
                  // The custom-registry branch's "Set subregistry" call is fully
                  // known upfront (user-provided address), so its gas can be
                  // estimated the moment the modal opens.
                  intent: {
                    prepare: customSubregistryAddress
                      ? ({ walletClient, chainId }) =>
                          prepareSetSubregistryTransaction({
                            label,
                            parentRegistry,
                            subregistryAddress: customSubregistryAddress,
                            walletClient,
                            chainId,
                          })
                      : undefined,
                  },
                  onStart: handleSetSubregistryStart,
                  onDone: handleSetSubregistryDone,
                },
              ]
        }
      />
    </div>
  )
}
