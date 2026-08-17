import type { Role } from '@ensdomains/ensjs/utils/v2'
import { useQuery } from '@tanstack/react-query'
import { type FormEvent, useEffect, useState } from 'react'
import { match } from 'ts-pattern'
import { type Address, zeroAddress } from 'viem'
import { useWalletClient } from 'wagmi'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { AddressNameInput } from '@/features/address/components/AddressNameInput'
import { useAddressResolution } from '@/features/address/hooks/useAddressResolution'
import { prepareGrantRolesTransaction } from '@/features/roles/helpers/grantRoles'
import { useGrantRoles } from '@/features/roles/hooks/useGrantRoles'
import { getNameRolesForAccountQueryOptions } from '@/features/roles/hooks/useNameRolesForAccount'
import { TransactionModal } from '@/features/transaction-manager/components/TransactionModal'
import { useTransactionModal } from '@/features/transaction-manager/hooks/useTransactionModal'
import {
  isAdminRole,
  isManagerRoleSettable,
  permissions,
} from '@/lib/roles/permissions'
import { cn } from '@/lib/utils'
import { truncateAddress } from '@/utils/formatting/truncateAddress'

const GRANT_ROLES_TX_ID = 'tx-grant-roles'

type RolesAddUserSheetProps = {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly name: string
  readonly registryAddress: Address
}

export const RolesAddUserSheet = ({
  open,
  onOpenChange,
  name,
  registryAddress,
}: RolesAddUserSheetProps) => {
  const { data: walletClient } = useWalletClient()
  const callerAddress = walletClient?.account?.address

  const labels = name.split('.')
  const is2LD = labels.length === 2

  const { data: callerRolesData } = useQuery({
    ...getNameRolesForAccountQueryOptions({
      registryAddress,
      label: labels[0],
      account: callerAddress ?? zeroAddress,
    }),
    enabled: Boolean(callerAddress),
  })

  const callerAdminRoles = new Set<Role>(
    (callerRolesData?.decoded ?? []).filter((r): r is Role => isAdminRole(r)),
  )

  const [userInput, setUserInput] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<Set<Role>>(new Set())
  const [pendingGrant, setPendingGrant] = useState<{
    readonly account: Address
    readonly roles: Role[]
  } | null>(null)

  const resolution = useAddressResolution(userInput)
  const { address, isResolving } = resolution

  const { openModal, closeModal, clearTransaction } = useTransactionModal()
  const { grantRoles, isPending, isSuccess, reset } = useGrantRoles()

  // Reset form + mutation when the sheet closes, otherwise `isSuccess` sticks
  // across re-opens and leaves the input disabled / Save permanently gated.
  // Clearing `userInput` also resets the derived resolution state.
  useEffect(() => {
    if (open) return
    setUserInput('')
    setSelectedRoles(new Set())
    setPendingGrant(null)
    reset()
  }, [open, reset])

  const toggleRole = (role: Role, checked: boolean) => {
    setSelectedRoles((prev) => {
      const next = new Set(prev)
      if (checked) next.add(role)
      else next.delete(role)
      return next
    })
  }

  const canSave =
    !!address && !isResolving && selectedRoles.size > 0 && !isSuccess

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!address || selectedRoles.size === 0) return
    reset()
    setPendingGrant({ account: address, roles: Array.from(selectedRoles) })
    openModal()
  }

  const handleStartTransaction = () => {
    if (!pendingGrant || !walletClient?.account) return
    grantRoles({
      name,
      account: pendingGrant.account,
      roles: pendingGrant.roles,
      id: GRANT_ROLES_TX_ID,
      registryAddress,
    })
  }

  const handleDone = () => {
    closeModal()
    clearTransaction()
    setPendingGrant(null)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="bg-background p-0">
        <div className="h-full overflow-y-auto">
          <div className="p-6 flex flex-col gap-6 h-full">
            <SheetHeader className="p-0">
              <SheetTitle className="font-sans text-h2">Add user</SheetTitle>
            </SheetHeader>

            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-6 flex-1"
            >
              <Field>
                <AddressNameInput
                  id="user"
                  name="user"
                  aria-label="User name or address"
                  placeholder="User name or address"
                  required
                  value={userInput}
                  onChange={setUserInput}
                  resolution={resolution}
                  disabled={isPending || isSuccess}
                  className="h-12 bg-background border"
                />
              </Field>

              <Field>
                <div
                  className={cn(
                    'border border-border rounded-sm overflow-hidden transition-colors',
                    (isPending || isSuccess) &&
                      'opacity-50 pointer-events-none',
                  )}
                >
                  {permissions.map((permission, index) => {
                    const managerRole = permission.key as Role
                    const adminRole = `${permission.key}_ADMIN` as Role
                    const callerHasAdminRole = callerAdminRoles.has(adminRole)
                    const isManagerRoleDisabled =
                      !isManagerRoleSettable(permission.key, { is2LD }) ||
                      !callerHasAdminRole

                    return (
                      <div
                        key={permission.key}
                        className={cn(
                          'flex items-center justify-between px-6 py-4 gap-4',
                          index !== 0 && 'border-t border-border',
                          isManagerRoleDisabled && 'text-muted-foreground',
                        )}
                        title={
                          callerHasAdminRole
                            ? undefined
                            : `Your account does not hold ${adminRole} on this name and cannot grant this role.`
                        }
                      >
                        <div className="flex flex-col gap-1 flex-1 min-w-64">
                          <div className="font-medium">{permission.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {permission.description}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 flex-1 min-w-64 justify-end">
                          <div className="flex items-center gap-2 min-w-24">
                            <Checkbox
                              id={`add-${permission.key}-manager`}
                              checked={selectedRoles.has(managerRole)}
                              disabled={isManagerRoleDisabled}
                              onCheckedChange={(checked) =>
                                toggleRole(managerRole, checked as boolean)
                              }
                            />
                            <Label
                              htmlFor={`add-${permission.key}-manager`}
                              className="font-medium cursor-pointer"
                            >
                              Manager
                            </Label>
                          </div>
                          <div className="flex items-center gap-2 min-w-24">
                            <Checkbox
                              id={`add-${permission.key}-admin`}
                              checked={selectedRoles.has(adminRole)}
                              disabled
                            />
                            <Label
                              htmlFor={`add-${permission.key}-admin`}
                              className="font-medium cursor-pointer"
                            >
                              Admin
                            </Label>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Field>

              <div className="flex justify-end">
                <Button type="submit" variant="default" disabled={!canSave}>
                  {match({ isPending, isSuccess })
                    .with({ isSuccess: true }, () => 'Transaction Complete')
                    .with({ isPending: true }, () => 'Saving...')
                    .otherwise(() => 'Save')}
                </Button>
              </div>
            </form>

            <TransactionModal
              transactions={[
                {
                  id: GRANT_ROLES_TX_ID,
                  title: 'Grant roles',
                  transactionName: address
                    ? `Grant roles for ${truncateAddress(address, 6, 4)}`
                    : 'Grant roles',
                  intent: {
                    prepare: pendingGrant
                      ? ({ walletClient, chainId }) =>
                          prepareGrantRolesTransaction({
                            name,
                            account: pendingGrant.account,
                            roles: pendingGrant.roles,
                            walletClient,
                            chainId,
                            registryAddress,
                          })
                      : undefined,
                  },
                  onStart: handleStartTransaction,
                  onDone: handleDone,
                },
              ]}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
