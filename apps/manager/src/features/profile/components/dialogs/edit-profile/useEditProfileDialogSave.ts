import { $qk } from '@ens-apps/utils/tanstack-query/queryKey'
import { parseInput } from '@ensdomains/ensjs/utils'
import { t } from '@lingui/core/macro'
import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { match } from 'ts-pattern'
import type { Address, PublicClient } from 'viem'
import { useAccount, useChainId, useSignTypedData } from 'wagmi'
import type { Actor } from 'xstate'
import {
  getActiveSignedProfileImageUploads,
  refreshProfileImageCaches,
  type SignedProfileImageUpload,
} from '@/features/profile/service/profileImageCache'
import {
  type PreparedProfileImageUpload,
  submitPreparedProfileImageUpload,
} from '@/features/profile/service/profileImageUpload'
import {
  type SaveRecordsParams,
  saveRecords,
} from '@/features/profile/service/profileRecordTransactions'
import { resolverWriteAccessQuery } from '@/features/profile/service/resolverWriteAccess'
import { setupControlledResolver } from '@/features/profile/service/setupControlledResolver'
import type { ProfileRecords } from '@/features/profile/types'
import { useSmartAccountContext } from '@/lib/smart-account'
import { publicClient } from '@/lib/wagmi'
import {
  type editProfileDialogMachine,
  hasOwnerWallet,
  type PendingSave,
} from './EditProfileDialog.machine'
import type {
  EditProfileForm,
  EditProfileSaveHandler,
} from './EditProfileDialog.types'

type DeferredEditProfileSave = {
  readonly currentRecords: ProfileRecords
  readonly options: Parameters<EditProfileSaveHandler>[1]
}

interface UseCloseProfileDialogOnSuccessfulSaveParams {
  readonly dialogActor: Actor<typeof editProfileDialogMachine>
  readonly ethAddressChanged: boolean
  readonly form: EditProfileForm
  readonly isSuccess: boolean
  readonly name: string
  readonly onPreparedImageUploadsSaved: () => void
  readonly onUpdated?: () => undefined | Promise<unknown>
  readonly preparedImageUploads: readonly PreparedProfileImageUpload[]
  readonly queryClient: QueryClient
  readonly savedRecords: ProfileRecords
}

interface UseEditProfileDialogSaveParams {
  readonly dialogActor: Actor<typeof editProfileDialogMachine>
  readonly ethAddressChanged: boolean
  readonly form: EditProfileForm
  readonly isSuccess: boolean
  readonly name: string
  readonly onUpdated?: () => undefined | Promise<unknown>
  readonly open: boolean
  readonly owner?: Address
  readonly savedRecords: ProfileRecords
}

interface SaveRecordsMutationVariables extends SaveRecordsParams {
  readonly currentRecords: ProfileRecords
}

interface SetupResolverMutationVariables {
  readonly pendingSave: Extract<PendingSave, { kind: 'setup' }>
}

interface SaveBlockedPrerequisites {
  readonly hasOwner: boolean
  readonly hasAccount: boolean
  readonly hasSetupSigner: boolean
}

const getSaveBlockedDescription = ({
  hasOwner,
  hasAccount,
  hasSetupSigner,
}: SaveBlockedPrerequisites) =>
  match({ hasOwner, hasAccount, hasSetupSigner })
    .with(
      { hasOwner: false },
      () => t`Name owner is not available yet. Try again in a moment.`,
    )
    .with(
      { hasAccount: false },
      () =>
        t`Wallet account is not ready. Wait for your account to finish connecting, then try again.`,
    )
    .with(
      { hasSetupSigner: false },
      () => t`Please finish connecting your wallet, then try again`,
    )
    .otherwise(
      () => t`Something went wrong preparing the save. Please try again.`,
    )

const ethCoinValue = (coins: readonly { coinType: number; value: string }[]) =>
  coins.find(({ coinType }) => coinType === 60)?.value

const toastSaveError = (error: unknown) => {
  toast.error(t`Cannot save profile`, {
    description:
      error instanceof Error
        ? error.message
        : t`Something went wrong preparing the save. Please try again.`,
  })
}

const useCloseProfileDialogOnSuccessfulSave = ({
  dialogActor,
  ethAddressChanged,
  form,
  isSuccess,
  name,
  onPreparedImageUploadsSaved,
  onUpdated,
  preparedImageUploads,
  queryClient,
  savedRecords,
}: UseCloseProfileDialogOnSuccessfulSaveParams) => {
  useEffect(() => {
    if (!isSuccess) {
      return
    }

    let cancelled = false

    const finalizeSave = async () => {
      form.reset(savedRecords)
      await onUpdated?.()
      await refreshProfileImageCaches({
        images: getActiveSignedProfileImageUploads({
          images: preparedImageUploads,
          records: savedRecords,
        }),
        name,
        queryClient,
      })
      onPreparedImageUploadsSaved()

      if (ethAddressChanged) {
        queryClient.invalidateQueries({
          queryKey: $qk({ $scope: 'profile', $action: 'reverse_name' }),
        })
      }

      queryClient.invalidateQueries({
        queryKey: $qk({ $scope: 'profile', $action: 'resolver_write_access' }),
      })
      queryClient.invalidateQueries({
        queryKey: $qk({ $scope: 'profile', $action: 'get_records' }),
      })

      if (!cancelled) {
        dialogActor.send({ type: 'CLOSE' })
      }
    }

    void finalizeSave()

    return () => {
      cancelled = true
    }
  }, [
    dialogActor,
    ethAddressChanged,
    form,
    isSuccess,
    name,
    onPreparedImageUploadsSaved,
    onUpdated,
    preparedImageUploads,
    queryClient,
    savedRecords,
  ])
}

export const useEditProfileDialogSave = ({
  dialogActor,
  ethAddressChanged,
  form,
  isSuccess,
  name,
  onUpdated,
  open,
  owner,
  savedRecords,
}: UseEditProfileDialogSaveParams) => {
  const account = useSmartAccountContext()
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const queryClient = useQueryClient()
  const { signTypedDataAsync } = useSignTypedData()
  const [preparedImageUploads, setPreparedImageUploads] = useState<
    readonly PreparedProfileImageUpload[]
  >([])
  const [isFinalizingImageSave, setIsFinalizingImageSave] = useState(false)
  const [setupConfirmOpen, setSetupConfirmOpen] = useState(false)
  const deferredSetupSaveRef = useRef<DeferredEditProfileSave | null>(null)

  const ownerAddress = account.ownerAddress as Address | null
  const hasResolver = Boolean(savedRecords.resolverAddress)

  // Probe write access whenever a resolver is present.
  const resolverWriteAccess = useQuery({
    ...resolverWriteAccessQuery(name, ownerAddress ?? undefined),
    enabled: open && hasResolver && Boolean(ownerAddress),
  })

  const needsResolverSetup =
    !hasResolver ||
    (Boolean(ownerAddress) && resolverWriteAccess.data === false)

  const isResolverAccessPending =
    hasResolver && Boolean(ownerAddress) && resolverWriteAccess.isLoading

  const saveRecordsMutation = useMutation({
    mutationFn: ({
      currentRecords: _currentRecords,
      ...params
    }: SaveRecordsMutationVariables) => saveRecords(params),
    onSuccess: (_data, variables) => {
      dialogActor.send({
        type: 'SAVE_SUCCEEDED',
        currentRecords: variables.currentRecords,
        ethAddressChanged:
          ethCoinValue(variables.before.coins) !==
          ethCoinValue(variables.after.coins),
      })
    },
    onError: (error) => {
      dialogActor.send({ type: 'RESET_SAVE_STATE' })
      toastSaveError(error)
    },
  })

  const setupResolverMutation = useMutation({
    mutationFn: async ({ pendingSave }: SetupResolverMutationVariables) => {
      const resolver = await setupControlledResolver({
        name: pendingSave.name,
        signer: pendingSave.signer,
        ownerAddress: pendingSave.ownerAddress,
        publicClient: pendingSave.publicClient,
        chainId: pendingSave.chainId,
        before: pendingSave.before,
        after: pendingSave.after,
        description: `Update profile records for ${pendingSave.name}`,
      })

      return {
        currentRecords: {
          ...pendingSave.currentRecords,
          resolverAddress: resolver,
        },
        ethAddressChanged: pendingSave.ethAddressChanged,
      }
    },
    onSuccess: ({ currentRecords, ethAddressChanged: ethChanged }) => {
      dialogActor.send({
        type: 'SAVE_SUCCEEDED',
        currentRecords,
        ethAddressChanged: ethChanged,
      })
    },
    onError: (error) => {
      dialogActor.send({ type: 'RESET_SAVE_STATE' })
      toastSaveError(error)
    },
  })

  const resetSaveState = useCallback(() => {
    saveRecordsMutation.reset()
    setupResolverMutation.reset()
    dialogActor.send({ type: 'RESET_SAVE_STATE' })
  }, [dialogActor, saveRecordsMutation, setupResolverMutation])

  const resetPreparedImageSaveState = useCallback(() => {
    setPreparedImageUploads([])
    setIsFinalizingImageSave(false)
  }, [])

  const handlePreparedImageUploadsSaved = useCallback(() => {
    setPreparedImageUploads([])
  }, [])

  const handleImageUploadPrepared = useCallback(
    (upload: PreparedProfileImageUpload) => {
      setPreparedImageUploads((currentUploads) => [
        ...currentUploads.filter(
          (currentUpload) => currentUpload.kind !== upload.kind,
        ),
        upload,
      ])
    },
    [],
  )

  const submitPreparedImageUploads = useCallback(
    async (uploads: readonly PreparedProfileImageUpload[]) => {
      if (uploads.length === 0) return

      if (!isConnected || !address) {
        throw new Error('Please connect your wallet before uploading an image')
      }

      for (const upload of uploads) {
        await submitPreparedProfileImageUpload({
          address,
          signTypedDataAsync,
          upload,
        })
      }
    },
    [address, isConnected, signTypedDataAsync],
  )

  const finalizeImageOnlySave = useCallback(
    async (
      currentRecords: ProfileRecords,
      images: readonly SignedProfileImageUpload[],
    ) => {
      setIsFinalizingImageSave(true)

      try {
        form.reset(currentRecords)
        await onUpdated?.()
        await refreshProfileImageCaches({
          images,
          name,
          queryClient,
        })
        setPreparedImageUploads([])
        dialogActor.send({ type: 'CLOSE' })
      } catch {
        dialogActor.send({ type: 'RESET_SAVE_STATE' })
      } finally {
        setIsFinalizingImageSave(false)
      }
    },
    [dialogActor, form, name, onUpdated, queryClient],
  )

  const getPendingRecordSave = useCallback(
    (currentRecords: ProfileRecords) => {
      const blockedReason = match({
        isResolverAccessPending,
        needsResolverSetup,
        is2LD: parseInput(name.endsWith('.eth') ? name : `${name}.eth`).is2LD,
      })
        .with(
          { isResolverAccessPending: true },
          () =>
            t`Still checking if you can edit this name. Try again in a moment.`,
        )
        .with(
          { needsResolverSetup: true, is2LD: false },
          () =>
            t`This subname can’t be set up here yet. Please set it up in the ENS app first.`,
        )
        .otherwise(() => null)

      if (blockedReason) {
        toast.error(t`Cannot save profile`, { description: blockedReason })
        return null
      }

      dialogActor.send({
        type: 'SAVE_REQUESTED',
        values: currentRecords,
        deps: {
          accountAddress: account.accountAddress as Address | null,
          chainId,
          name,
          needsResolverSetup,
          owner,
          ownerAddress,
          publicClient: publicClient as PublicClient,
          retryCount: 0,
          signer: account.signer,
          walletClient: account.walletClient,
        },
      })

      const snapshot = dialogActor.getSnapshot()
      const pendingSave = snapshot.matches({ editing: 'saving' })
        ? snapshot.context.pendingSave
        : undefined

      if (pendingSave) return pendingSave

      toast.error(t`Cannot save profile`, {
        description: getSaveBlockedDescription({
          hasOwner: Boolean(owner),
          // Mirrors the machine's `missingAccount` guard: setup needs the HCA
          // signer, an in-place write needs a connected wallet still bound to
          // the owner address.
          hasAccount: needsResolverSetup
            ? Boolean(account.signer && account.accountAddress)
            : hasOwnerWallet(account.walletClient, ownerAddress),
          hasSetupSigner: !(
            needsResolverSetup &&
            (account.signer?.type !== 'rhinestone' || !ownerAddress)
          ),
        }),
      })
      return null
    },
    [
      account.accountAddress,
      account.signer,
      account.walletClient,
      chainId,
      dialogActor,
      isResolverAccessPending,
      name,
      needsResolverSetup,
      owner,
      ownerAddress,
    ],
  )

  const submitPreparedImageUploadsForSave = useCallback(
    async (uploads: readonly PreparedProfileImageUpload[]) => {
      if (uploads.length === 0) return true

      setIsFinalizingImageSave(true)

      try {
        await submitPreparedImageUploads(uploads)
        return true
      } catch {
        dialogActor.send({ type: 'RESET_SAVE_STATE' })
        return false
      } finally {
        setIsFinalizingImageSave(false)
      }
    },
    [dialogActor, submitPreparedImageUploads],
  )

  const finalizePreparedImageOnlySave = useCallback(
    async ({
      currentRecords,
      hasRecordChanges,
      uploads,
    }: {
      readonly currentRecords: ProfileRecords
      readonly hasRecordChanges: boolean
      readonly uploads: readonly PreparedProfileImageUpload[]
    }) => {
      if (hasRecordChanges || uploads.length === 0) return false

      await finalizeImageOnlySave(currentRecords, uploads)
      return true
    },
    [finalizeImageOnlySave],
  )

  const submitPendingRecordSave = useCallback(
    (pendingRecordSave: PendingSave) => {
      match(pendingRecordSave)
        .with({ kind: 'setup' }, (pendingSave) => {
          setupResolverMutation.mutate({ pendingSave })
        })
        .with({ kind: 'update' }, (pendingSave) => {
          saveRecordsMutation.mutate({
            ...pendingSave.params,
            currentRecords: pendingSave.currentRecords,
          })
        })
        .exhaustive()
    },
    [saveRecordsMutation, setupResolverMutation],
  )

  const executeSave = useCallback<EditProfileSaveHandler>(
    (currentRecords, options) => {
      resetSaveState()

      void (async () => {
        const pendingRecordSave = options.hasRecordChanges
          ? getPendingRecordSave(currentRecords)
          : null

        if (options.hasRecordChanges && !pendingRecordSave) {
          return
        }

        const imageUploadsSubmitted = await submitPreparedImageUploadsForSave(
          options.preparedImageUploads,
        )

        if (!imageUploadsSubmitted) {
          return
        }

        const imageOnlySaveFinalized = await finalizePreparedImageOnlySave({
          currentRecords,
          hasRecordChanges: options.hasRecordChanges,
          uploads: options.preparedImageUploads,
        })

        if (imageOnlySaveFinalized) {
          return
        }

        pendingRecordSave && submitPendingRecordSave(pendingRecordSave)
      })()
    },
    [
      finalizePreparedImageOnlySave,
      getPendingRecordSave,
      resetSaveState,
      submitPendingRecordSave,
      submitPreparedImageUploadsForSave,
    ],
  )

  const handleSave = useCallback<EditProfileSaveHandler>(
    (currentRecords, options) => {
      if (options.hasRecordChanges && needsResolverSetup) {
        const blockedReason = match({
          isResolverAccessPending,
          is2LD: parseInput(name.endsWith('.eth') ? name : `${name}.eth`).is2LD,
        })
          .with(
            { isResolverAccessPending: true },
            () =>
              t`Still checking if you can edit this name. Try again in a moment.`,
          )
          .with(
            { is2LD: false },
            () =>
              t`This subname can’t be set up here yet. Please set it up in the ENS app first.`,
          )
          .otherwise(() => null)

        if (blockedReason) {
          toast.error(t`Cannot save profile`, { description: blockedReason })
          return
        }

        deferredSetupSaveRef.current = { currentRecords, options }
        setSetupConfirmOpen(true)
        return
      }

      executeSave(currentRecords, options)
    },
    [executeSave, isResolverAccessPending, name, needsResolverSetup],
  )

  const confirmSetupSave = useCallback(() => {
    const deferred = deferredSetupSaveRef.current
    deferredSetupSaveRef.current = null
    if (!deferred) return
    executeSave(deferred.currentRecords, deferred.options)
  }, [executeSave])

  const handleSetupConfirmOpenChange = useCallback((nextOpen: boolean) => {
    setSetupConfirmOpen(nextOpen)
    if (!nextOpen) {
      deferredSetupSaveRef.current = null
    }
  }, [])

  useCloseProfileDialogOnSuccessfulSave({
    dialogActor,
    ethAddressChanged,
    form,
    isSuccess,
    name,
    onPreparedImageUploadsSaved: handlePreparedImageUploadsSaved,
    onUpdated,
    preparedImageUploads,
    queryClient,
    savedRecords,
  })

  return {
    confirmSetupSave,
    handleSave,
    handleImageUploadPrepared,
    handleSetupConfirmOpenChange,
    isFinalizingImageSave,
    isResolverAccessPending,
    resetPreparedImageSaveState,
    preparedImageUploads,
    setupConfirmOpen,
  }
}
