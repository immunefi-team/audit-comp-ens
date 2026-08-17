import { Trans } from '@lingui/react/macro'
import { useActorRef, useSelector } from '@xstate/react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { ResolverSetupConfirmDialog } from '@/features/profile/components/dialogs/ResolverSetupConfirmDialog'
import { useAppForm } from '../../form'
import { EditProfileDialogProvider } from './EditProfileDialog.context'
import { editProfileDialogMachine } from './EditProfileDialog.machine'
import type { EditProfileDialogProps } from './EditProfileDialog.types'
import { EditProfileDialogBody } from './EditProfileDialogBody'
import { useEditProfileDialogSave } from './useEditProfileDialogSave'

export const EditProfileDialog = ({
  name,
  records,
  owner,
  onUpdated,
  trigger,
}: EditProfileDialogProps) => {
  const dialogActor = useActorRef(editProfileDialogMachine, {
    input: { records },
  })
  const open = useSelector(dialogActor, (state) => !state.matches('closed'))
  const savedRecords = useSelector(
    dialogActor,
    (state) => state.context.savedRecords,
  )
  const isSaving = useSelector(dialogActor, (state) =>
    state.matches({ editing: 'saving' }),
  )
  const isSuccess = useSelector(dialogActor, (state) =>
    state.matches({ editing: 'success' }),
  )
  const ethAddressChanged = useSelector(
    dialogActor,
    (state) => state.context.ethAddressChanged,
  )

  const form = useAppForm({
    defaultValues: records,
  })

  const {
    confirmSetupSave,
    handleSave,
    handleImageUploadPrepared,
    handleSetupConfirmOpenChange,
    isFinalizingImageSave,
    isResolverAccessPending,
    resetPreparedImageSaveState,
    preparedImageUploads,
    setupConfirmOpen,
  } = useEditProfileDialogSave({
    dialogActor,
    ethAddressChanged,
    form,
    isSuccess,
    name,
    onUpdated,
    open,
    owner,
    savedRecords,
  })

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      resetPreparedImageSaveState()
      form.reset(records)
      dialogActor.send({ type: 'OPEN', records })
      return
    }

    if (isSaving) {
      return
    }

    resetPreparedImageSaveState()
    dialogActor.send({ type: 'CLOSE' })
  }

  return (
    <>
      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogTrigger asChild>
          {trigger ?? (
            <Button className="w-full" type="button">
              <Trans>Edit Profile</Trans>
            </Button>
          )}
        </DialogTrigger>
        <DialogContent
          className="top-0 left-0 h-dvh max-h-dvh w-screen max-w-none! translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none border-[#dededf] border-[0.75px] bg-white p-0 shadow-lg sm:max-w-none! md:top-[50%] md:left-[50%] md:h-[min(90dvh,739px)] md:w-[min(92vw,800px)] md:max-w-200! md:translate-x-[-50%] md:translate-y-[-50%] md:rounded-xl"
          overlayClassName="bg-black/20 backdrop-blur-[2px]"
          showCloseButton={false}
        >
          <EditProfileDialogProvider actor={dialogActor}>
            <EditProfileDialogBody
              form={form}
              isFinalizingImageSave={isFinalizingImageSave}
              isResolverAccessPending={isResolverAccessPending}
              name={name}
              onImageUploadPrepared={handleImageUploadPrepared}
              onSave={handleSave}
              open={open}
              owner={owner}
              preparedImageUploads={preparedImageUploads}
              savedRecords={savedRecords}
            />
          </EditProfileDialogProvider>
        </DialogContent>
      </Dialog>

      <ResolverSetupConfirmDialog
        intent="edit-profile"
        onConfirm={confirmSetupSave}
        onOpenChange={handleSetupConfirmOpenChange}
        open={setupConfirmOpen}
      />
    </>
  )
}
