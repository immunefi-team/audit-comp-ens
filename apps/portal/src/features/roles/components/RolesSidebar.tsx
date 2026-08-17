import type { Role } from '@ensdomains/ensjs/utils/v2'
import { useQuery } from '@tanstack/react-query'
import type { Row } from '@tanstack/react-table'
import { Trash2 } from 'lucide-react'
import { type PropsWithChildren, useMemo, useState } from 'react'
import type { Address } from 'viem'
import { useWalletClient } from 'wagmi'
import { CopyButton } from '@/components/CopyButton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { getEnsOwnerQueryOptions } from '@/features/profile/hooks/useEnsOwner'
import { getNameLabels } from '@/features/registry/utils/nameUtils'
import { RoleHistoryTable } from '@/features/roles/components/RoleHistoryTable'
import { useEditedPermissions } from '@/features/roles/hooks/useEditedPermissions'
import { useGrantRoles } from '@/features/roles/hooks/useGrantRoles'
import { useRevokeRoles } from '@/features/roles/hooks/useRevokeRoles'
import type {
  PendingRemove,
  PendingSave,
} from '@/features/roles/utils/buildRoleTransactionDescriptors'
import { buildRoleTransactions } from '@/features/roles/utils/buildRoleTransactions'
import { TransactionModal } from '@/features/transaction-manager/components/TransactionModal'
import { useTransactionModal } from '@/features/transaction-manager/hooks/useTransactionModal'
import { useIsMobile } from '@/hooks/use-mobile'
import { isManagerRoleSettable, permissions } from '@/lib/roles/permissions'
import {
  computeRoleChanges,
  hasPermissionsChanged,
  roleToPermissions,
} from '@/lib/roles/rolesToPermissions'
import { cn } from '@/lib/utils'
import { truncateAddress } from '@/utils/formatting/truncateAddress'

type RolesSidebarProps<TData extends { items: string[]; account: Address }> =
  PropsWithChildren<{
    readonly row: Row<TData> | null
    readonly open: boolean
    readonly setOpen: React.Dispatch<React.SetStateAction<boolean>>
    readonly name: string
    readonly canManageRoles: boolean
    readonly registryAddress: Address
  }>

export const RolesSidebar = <
  TData extends { items: string[]; account: Address },
>({
  children,
  row,
  open,
  setOpen,
  name,
  canManageRoles,
  registryAddress,
}: RolesSidebarProps<TData>) => {
  const isMobile = useIsMobile()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null)
  const [pendingRemove, setPendingRemove] = useState<PendingRemove | null>(null)

  const { data: walletClient } = useWalletClient()
  const { openModal, closeModal, clearTransaction } = useTransactionModal()

  const { grantRoles } = useGrantRoles()
  const { revokeRoles } = useRevokeRoles()

  const selectedAccount = row?.original.account
  const { data: ownerData } = useQuery(getEnsOwnerQueryOptions({ name }))
  const isOwnerRole = selectedAccount === ownerData?.owner

  const originalRoles = useMemo(
    () => (row?.original.items ?? []) as Role[],
    [row],
  )

  const { editedPermissions, setEditedPermissions } = useEditedPermissions(row)

  const hasChanges = hasPermissionsChanged(
    roleToPermissions(originalRoles),
    editedPermissions,
  )
  const { rolesToGrant, rolesToRevoke } = computeRoleChanges(
    originalRoles,
    editedPermissions,
  )

  const handleDone = () => {
    closeModal()
    clearTransaction()
    setPendingSave(null)
    setPendingRemove(null)
    setOpen(false)
  }

  const handleSaveChanges = () => {
    if (!selectedAccount || !hasChanges || !walletClient?.account) return

    setOpen(false)
    setPendingSave({
      account: selectedAccount,
      rolesToGrant: rolesToGrant as Role[],
      rolesToRevoke: rolesToRevoke as Role[],
    })
    setPendingRemove(null)
    openModal()
  }

  const handleRemoveUser = () => {
    if (
      !selectedAccount ||
      originalRoles.length === 0 ||
      !walletClient?.account
    )
      return

    setConfirmOpen(false)
    setOpen(false)
    setPendingRemove({
      account: selectedAccount,
      roles: originalRoles,
    })
    setPendingSave(null)
    openModal()
  }

  const handlePermissionChange = (
    roleKey: string,
    permissionType: 'admin' | 'manager',
    checked: boolean,
  ) => {
    setEditedPermissions((prev) => {
      const newMap = new Map(prev)
      const current = newMap.get(roleKey) || { admin: false, manager: false }
      newMap.set(roleKey, { ...current, [permissionType]: checked })
      return newMap
    })
  }

  const isWalletConnected = Boolean(walletClient?.account)
  const is2LD = name.split('.').length === 2

  const transactions = selectedAccount
    ? buildRoleTransactions(
        pendingSave,
        pendingRemove,
        name,
        {
          grantRoles: (params) =>
            grantRoles({
              ...params,
              roles: [...params.roles],
            }),
          revokeRoles: (params) =>
            revokeRoles({
              ...params,
              roles: [...params.roles],
            }),
          handleDone,
        },
        registryAddress,
      )
    : []

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen} defaultOpen={false}>
        {children}
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          className="bg-background p-0"
        >
          <div className="h-full overflow-y-auto">
            <div className="p-6 flex flex-col gap-6 h-full">
              <SheetHeader className="p-0 flex flex-row items-center justify-between gap-4">
                {selectedAccount ? (
                  <SheetTitle className="font-sans text-h2 flex items-center gap-1">
                    {truncateAddress(selectedAccount, 6, 4)}
                    <CopyButton value={selectedAccount} />
                  </SheetTitle>
                ) : null}
                {canManageRoles && selectedAccount && (
                  <Button
                    variant="outline"
                    disabled={!isWalletConnected}
                    onClick={() => setConfirmOpen(true)}
                  >
                    <Trash2 className="size-4" />
                    Remove user
                  </Button>
                )}
              </SheetHeader>

              {row ? (
                <div className="flex flex-col gap-6">
                  {/* Permissions Section */}
                  <div className="border border-border rounded-sm overflow-hidden">
                    {permissions.map((permission, index) => {
                      const roleKey = permission.key
                      const isManagerRoleDisabled = !isManagerRoleSettable(
                        permission.key,
                        { is2LD },
                      )
                      const rolePerms = editedPermissions.get(roleKey) || {
                        admin: false,
                        manager: false,
                      }

                      return (
                        <div
                          key={permission.key}
                          className={cn(
                            'flex items-center justify-between px-6 py-4 gap-4',
                            index !== 0 && 'border-t border-border',
                            isManagerRoleDisabled && 'text-muted-foreground',
                          )}
                        >
                          <div className="flex flex-col gap-1 flex-1 min-w-64">
                            <div className="font-medium">
                              {permission.title}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {permission.description}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 flex-1 min-w-64 justify-end">
                            <div className="flex items-center gap-2 min-w-24">
                              <Checkbox
                                id={`${permission.key}-manager`}
                                checked={rolePerms.manager}
                                disabled={
                                  !canManageRoles || isManagerRoleDisabled
                                }
                                onCheckedChange={(checked) =>
                                  handlePermissionChange(
                                    roleKey,
                                    'manager',
                                    checked as boolean,
                                  )
                                }
                              />
                              <Label
                                htmlFor={`${permission.key}-manager`}
                                className={cn(
                                  'font-medium cursor-pointer',
                                  canManageRoles
                                    ? 'text-foreground'
                                    : 'text-muted-foreground',
                                )}
                              >
                                Manager
                              </Label>
                            </div>
                            <div className="flex items-center gap-2 min-w-24">
                              <Checkbox
                                id={`${permission.key}-admin`}
                                checked={rolePerms.admin}
                                disabled
                              />
                              <Label
                                htmlFor={`${permission.key}-admin`}
                                className={cn(
                                  'font-medium cursor-pointer',
                                  canManageRoles
                                    ? 'text-foreground'
                                    : 'text-muted-foreground',
                                )}
                              >
                                Admin
                              </Label>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {isOwnerRole && canManageRoles && (
                    <Alert variant="warning">
                      <AlertDescription>
                        This account is the owner of {name}. Removing or
                        changing its roles can lock you out of managing the
                        name.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex justify-end">
                    <Button
                      variant="default"
                      disabled={!hasChanges || !isWalletConnected}
                      onClick={handleSaveChanges}
                    >
                      Save
                    </Button>
                  </div>

                  {/* History Section */}
                  <div className="flex flex-col gap-4 mt-5">
                    <div className="flex flex-wrap justify-between items-center gap-4">
                      <h3 className="text-2xl font-medium leading-snug">
                        History
                      </h3>
                    </div>

                    <div className="border border-border rounded-sm overflow-hidden p-0 [&_th:first-child]:pl-4 [&_td:first-child]:pl-4 [&_th:last-child]:pr-4 [&_td:last-child]:pr-4">
                      <RoleHistoryTable
                        name={name}
                        label={getNameLabels(name).currentLabel}
                        account={selectedAccount}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground text-center py-12">
                  No role selected
                </div>
              )}
            </div>
          </div>

          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Remove user</DialogTitle>
                <DialogDescription>
                  {isOwnerRole
                    ? 'You are trying to delete the owner of this name. Deleting it would prohibit you from adding more users. Are you sure?'
                    : 'Are you sure you want to remove this user from all roles? This action cannot be undone.'}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  variant="danger"
                  onClick={() => {
                    setConfirmOpen(false)
                    handleRemoveUser()
                  }}
                >
                  Remove
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </SheetContent>
      </Sheet>

      {transactions.length > 0 && (
        <TransactionModal transactions={transactions} />
      )}
    </>
  )
}
