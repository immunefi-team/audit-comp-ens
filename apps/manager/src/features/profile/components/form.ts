import {
  createFormHook,
  createFormHookContexts,
  formOptions,
} from '@tanstack/react-form'
import { defaultProfileRecords } from '../utils/transformRecords'

const { fieldContext, formContext } = createFormHookContexts()

export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {},
  formComponents: {},
})

export const sharedOptions = formOptions({
  defaultValues: defaultProfileRecords,
})
