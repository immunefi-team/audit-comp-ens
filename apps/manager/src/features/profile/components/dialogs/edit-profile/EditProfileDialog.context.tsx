import { shallowEqual, useSelector } from '@xstate/react'
import { createContext, use, useMemo } from 'react'
import type { Actor } from 'xstate'
import type {
  EditProfileDialogSnapshot,
  editProfileDialogMachine,
} from './EditProfileDialog.machine'
import type { GeneralField } from './tabs/general/fields'

interface EditProfileDialogContextValue {
  readonly dialogActor: Actor<typeof editProfileDialogMachine>
}

const EditProfileDialogContext =
  createContext<EditProfileDialogContextValue | null>(null)

interface EditProfileDialogProviderProps {
  readonly actor: Actor<typeof editProfileDialogMachine>
  readonly children: React.ReactNode
}

export const EditProfileDialogProvider = ({
  actor,
  children,
}: EditProfileDialogProviderProps) => (
  <EditProfileDialogContext.Provider value={{ dialogActor: actor }}>
    {children}
  </EditProfileDialogContext.Provider>
)

const useEditProfileDialogContext = () => {
  const context = use(EditProfileDialogContext)
  if (!context) {
    throw new Error('You used a hook outside of the EditProfileDialogProvider')
  }
  return context
}

const useEditProfileDialogSelector = <T,>(
  selector: (snapshot: EditProfileDialogSnapshot) => T,
  compare?: (a: T, b: T) => boolean,
) => {
  const { dialogActor } = useEditProfileDialogContext()
  return useSelector(dialogActor, selector, compare)
}

export const useEditProfileDialogStatus = () =>
  useEditProfileDialogSelector(
    (snapshot) => ({
      isSaving: snapshot.matches({ editing: 'saving' }),
    }),
    shallowEqual,
  )

export const useEditProfileVisibleFields = () =>
  useEditProfileDialogSelector((snapshot) => snapshot.context.visibleFields)

export const useEditProfileDialogActions = () => {
  const { dialogActor } = useEditProfileDialogContext()

  return useMemo(
    () => ({
      showField: (field: GeneralField) =>
        dialogActor.send({ type: 'SHOW_GENERAL_FIELD', field }),
      toggleField: (field: GeneralField) =>
        dialogActor.send({ type: 'TOGGLE_GENERAL_FIELD', field }),
    }),
    [dialogActor],
  )
}
