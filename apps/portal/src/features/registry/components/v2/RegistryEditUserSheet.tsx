import type { Role } from '@ensdomains/ensjs/utils/v2'
import { useQuery } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { match } from 'ts-pattern'
import type { Address } from 'viem'
import { useEnsName, useWalletClient } from 'wagmi'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldError } from '@/components/ui/field'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { prepareGrantRegistryRolesTransaction } from '@/features/registry/helpers/grantRegistryRoles'
import { prepareRevokeRegistryRolesTransaction } from '@/features/registry/helpers/revokeRegistryRoles'
import { useGrantRegistryRolesMutation } from '@/features/registry/hooks/useGrantRegistryRoles'
import { useRevokeRegistryRolesMutation } from '@/features/registry/hooks/useRevokeRegistryRoles'
import { TransactionModal } from '@/features/transaction-manager/components/TransactionModal'
import { useTransactionModal } from '@/features/transaction-manager/hooks/useTransactionModal'
import type {
  IntentContext,
  Transaction,
} from '@/features/transaction-manager/types'
import { truncateAddress } from '@/utils/formatting/truncateAddress'
import { getRegistryRolesQueryOptions } from '../../hooks/useRegistryRoles'
import {
  computeRoleDiff,
  getAccountAdminRoles,
  getRemovableRoles,
  getSoleAdminRoles,
} from '../../utils/registryRoleAccess'
import { RegistryRolePermissionList } from './RegistryRolePermissionList'
import { RegistryUserRoleHistory } from './RegistryUserRoleHistory'

const GRANT_TX_ID = 'tx-edit-registry-roles-grant'
const REVOKE_TX_ID = 'tx-edit-registry-roles-revoke'

type RegistryEditUserSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  registryAddress: Address
  /** The user being edited. Null when no row is selected (sheet closed). */
  account: Address | null
  /** The user's currently held roles at the registry root resource. */
  currentRoles: readonly Role[]
}

export const RegistryEditUserSheet = ({
  open,
  onOpenChange,
  registryAddress,
  account,
  currentRoles,
}: RegistryEditUserSheetProps) => {
  const { data: walletClient } = useWalletClient()
  const callerAddress = walletClient?.account?.address

  const { data: primaryName } = useEnsName({
    address: account ?? undefined,
  })
  const titleLabel = account
    ? (primaryName ?? truncateAddress(account, 6, 4))
    : 'Edit user'

  const { data: rolesData } = useQuery({
    ...getRegistryRolesQueryOptions({ address: registryAddress }),
    enabled: Boolean(callerAddress),
  })

  const callerAdminRoles = getAccountAdminRoles(rolesData, callerAddress)

  const initialRoles = new Set<Role>(currentRoles)

  const [selectedRoles, setSelectedRoles] = useState<Set<Role>>(initialRoles)
  // The roles to grant/revoke once the user confirms — a single object so the
  // modal steps derive directly from it (grant step if `toGrant`, revoke step
  // if `toRevoke`). null while no transaction is in flight.
  const [pending, setPending] = useState<{
    toGrant: Role[]
    toRevoke: Role[]
  } | null>(null)
  const [submitFeedback, setSubmitFeedback] = useState<string | null>(null)
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false)

  const { openModal, closeModal, clearTransaction } = useTransactionModal()
  const { grantRegistryRoles, isPending: isGrantPending } =
    useGrantRegistryRolesMutation()
  const { revokeRegistryRoles, isPending: isRevokePending } =
    useRevokeRegistryRolesMutation()

  const isPending = isGrantPending || isRevokePending

  useEffect(() => {
    if (!open) return
    setSelectedRoles(new Set(currentRoles))
    setPending(null)
    setSubmitFeedback(null)
    setIsRemoveConfirmOpen(false)
  }, [open, currentRoles])

  const toggleRole = (role: Role, checked: boolean) => {
    setSelectedRoles((prev) => {
      const next = new Set(prev)
      if (checked) next.add(role)
      else next.delete(role)
      return next
    })
    setSubmitFeedback(null)
  }

  const diff = computeRoleDiff(initialRoles, selectedRoles)

  const hasChanges = diff.toGrant.length > 0 || diff.toRevoke.length > 0

  const isSelfEdit =
    !!account &&
    !!callerAddress &&
    account.toLowerCase() === callerAddress.toLowerCase()

  // Only relevant for a self-edit: warn when the caller is about to revoke an
  // admin role no one else holds (locking themselves out).
  const selfSoleAdminRoles = isSelfEdit
    ? getSoleAdminRoles(rolesData, account)
    : new Set<Role>()

  const adminLockoutRoles = diff.toRevoke.filter((role) =>
    selfSoleAdminRoles.has(role),
  )
  const willLockOutAdmin = adminLockoutRoles.length > 0

  const runEdit = (toGrant: Role[], toRevoke: Role[]) => {
    if (!account || !walletClient?.account) return
    if (toGrant.length === 0 && toRevoke.length === 0) return
    setPending({ toGrant, toRevoke })
    openModal()
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!hasChanges) {
      setSubmitFeedback('No changes to save')
      return
    }
    // Note: we deliberately do NOT block when `willLockOutAdmin`. The
    // destructive Alert above is the consent contract — the user is told
    // exactly what will happen and gets to decide.
    runEdit(diff.toGrant, diff.toRevoke)
  }

  const removableRoles = getRemovableRoles(currentRoles, callerAdminRoles)

  const removeAdminLockoutRoles = removableRoles.filter((role) =>
    selfSoleAdminRoles.has(role),
  )
  const removeWillLockOutAdmin = removeAdminLockoutRoles.length > 0

  const lockoutCount = adminLockoutRoles.length

  const handleRemove = () => {
    if (removableRoles.length === 0) return
    // Removing a sole-admin role is a permanent lockout — confirm first.
    if (removeWillLockOutAdmin) {
      setIsRemoveConfirmOpen(true)
      return
    }
    runEdit([], removableRoles)
  }

  const confirmRemove = () => {
    setIsRemoveConfirmOpen(false)
    runEdit([], removableRoles)
  }

  const handleDone = () => {
    closeModal()
    clearTransaction()
    setPending(null)
    onOpenChange(false)
  }

  const handleStepDone = () => {
    clearTransaction()
  }

  // The prepared grant/revoke transaction for a step — deterministic given the
  // account and roles, so the modal can estimate gas the moment it opens. Yields
  // a lazy thunk (or undefined until an account is selected) that the modal
  // calls with the ready wallet context.
  const rolesIntentThunk = (kind: 'grant' | 'revoke', roles: Role[]) =>
    account
      ? ({ walletClient, chainId }: IntentContext) =>
          (kind === 'grant'
            ? prepareGrantRegistryRolesTransaction
            : prepareRevokeRegistryRolesTransaction)({
            registryAddress,
            account,
            roles,
            walletClient,
            chainId,
          })
      : undefined

  // Derive the modal steps straight from `pending`: a grant step when there are
  // roles to grant, then a revoke step when there are roles to revoke. The grant
  // step hands off to the revoke step (if any), and the last step finishes.
  const buildModalTransactions = (): Transaction[] => {
    if (!pending || !account) return []

    const { toGrant, toRevoke } = pending
    const hasRevokeStep = toRevoke.length > 0
    const steps: Transaction[] = []

    if (toGrant.length > 0) {
      steps.push({
        id: GRANT_TX_ID,
        title: 'Grant roles',
        transactionName: 'Grant registry roles',
        intent: { prepare: rolesIntentThunk('grant', toGrant) },
        onStart: () =>
          grantRegistryRoles({
            registryAddress,
            account,
            roles: toGrant,
            id: GRANT_TX_ID,
          }),
        onDone: hasRevokeStep ? handleStepDone : handleDone,
      })
    }

    if (hasRevokeStep) {
      steps.push({
        id: REVOKE_TX_ID,
        title: 'Revoke roles',
        transactionName: 'Revoke registry roles',
        intent: { prepare: rolesIntentThunk('revoke', toRevoke) },
        onStart: () =>
          revokeRegistryRoles({
            registryAddress,
            account,
            roles: toRevoke,
            id: REVOKE_TX_ID,
          }),
        onDone: handleDone,
      })
    }

    return steps
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="bg-background p-0">
        <div className="h-full overflow-y-auto">
          <div className="p-6 flex flex-col gap-6 h-full">
            <SheetHeader className="p-0 flex flex-row items-center justify-between gap-4">
              <SheetTitle className="font-sans text-h2">
                {titleLabel}
              </SheetTitle>
              <Button
                type="button"
                variant="outline"
                onClick={handleRemove}
                disabled={removableRoles.length === 0 || isPending}
              >
                <Trash2 className="size-4" />
                Remove user
              </Button>
            </SheetHeader>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <Field>
                <RegistryRolePermissionList
                  selectedRoles={selectedRoles}
                  callerAdminRoles={callerAdminRoles}
                  onToggle={toggleRole}
                  disabled={isPending}
                  idPrefix="edit-"
                />
                {submitFeedback && (
                  <FieldError className="mt-1.5">{submitFeedback}</FieldError>
                )}
              </Field>

              {willLockOutAdmin && (
                <Alert variant="warning">
                  <AlertDescription>
                    You're the only Admin for{' '}
                    {lockoutCount === 1 ? 'this role' : 'these roles'}. Removing{' '}
                    {lockoutCount === 1 ? 'it' : 'them'} will permanently lock
                    out admin control.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end">
                <Button type="submit" variant="default" disabled={!hasChanges}>
                  {match({ isPending })
                    .with({ isPending: true }, () => 'Saving...')
                    .otherwise(() => 'Save')}
                </Button>
              </div>
            </form>

            <RegistryUserRoleHistory
              registryAddress={registryAddress}
              account={account}
            />

            <TransactionModal transactions={buildModalTransactions()} />
          </div>
        </div>
      </SheetContent>

      <Dialog open={isRemoveConfirmOpen} onOpenChange={setIsRemoveConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove user?</DialogTitle>
            <DialogDescription>
              You're the only Admin for{' '}
              {removeAdminLockoutRoles.length === 1 ? 'one role' : 'some roles'}{' '}
              held by this user. Removing them will permanently lock out admin
              control.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsRemoveConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={confirmRemove}
              disabled={isPending}
            >
              Remove user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  )
}
