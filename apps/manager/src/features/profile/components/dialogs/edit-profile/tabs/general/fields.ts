import type { MaterialSymbol } from '@/components/ui/material-symbol'
import type { ProfileRecords, TextRecordValue } from '@/features/profile/types'
import { validateUrl } from '@/features/profile/utils/validateUrl'

type GeneralShortcut = {
  readonly field: string
  readonly label: string
  readonly symbol: MaterialSymbol
}

export const generalShortcuts = [
  { field: 'avatar', label: 'Profile picture', symbol: 'face' },
  { field: 'header', label: 'Banner', symbol: 'wall_art' },
  { field: 'url', label: 'Custom link', symbol: 'link' },
  { field: 'description', label: 'Description', symbol: 'text_ad' },
  { field: 'name', label: 'Full name', symbol: 'badge' },
  { field: 'location', label: 'Location', symbol: 'add_location_alt' },
  { field: 'timezone', label: 'Timezone', symbol: 'captive_portal' },
  { field: 'language', label: 'Language', symbol: 'language_chinese_array' },
] as const satisfies readonly GeneralShortcut[]

export type GeneralField = (typeof generalShortcuts)[number]['field']

export interface GeneralValidationIssue {
  readonly field: GeneralField
  readonly message: string
}

export const getTextRecordValue = (
  records: readonly TextRecordValue[],
  key: string,
) => records.find((record) => record.key === key)?.value ?? ''

export const getGeneralUrlErrorMessage = (value: string | undefined) =>
  validateUrl(value)

export const getGeneralValidationIssues = (
  records: ProfileRecords,
): readonly GeneralValidationIssue[] => {
  const urlMessage = getGeneralUrlErrorMessage(records.base.url)

  return urlMessage ? [{ field: 'url', message: urlMessage }] : []
}

const removeBaseRecord = (
  records: ProfileRecords,
  key: keyof ProfileRecords['base'],
): ProfileRecords => {
  if (!(key in records.base)) {
    return records
  }

  const nextBase = { ...records.base }
  delete nextBase[key]

  return { ...records, base: nextBase }
}

const removeContactRecord = (
  records: ProfileRecords,
  key: string,
): ProfileRecords => {
  const nextContact = records.contact.filter((record) => record.key !== key)

  return nextContact.length === records.contact.length
    ? records
    : { ...records, contact: nextContact }
}

export const removeGeneralFieldValue = (
  records: ProfileRecords,
  field: GeneralField,
): ProfileRecords => {
  switch (field) {
    case 'location':
    case 'timezone':
      return removeContactRecord(records, field)
    case 'avatar':
    case 'header':
    case 'url':
    case 'description':
    case 'name':
    case 'language':
      return removeBaseRecord(records, field)
  }
}

export const getDefaultVisibleFields = (
  records: ProfileRecords,
): ReadonlySet<GeneralField> =>
  new Set(
    generalShortcuts
      .map(({ field }) => field)
      .filter((field) => {
        if (
          field === 'avatar' ||
          field === 'header' ||
          field === 'url' ||
          field === 'description'
        ) {
          return true
        }

        if (field === 'location' || field === 'timezone') {
          return getTextRecordValue(records.contact, field).trim() !== ''
        }

        return (records.base[field] ?? '').trim() !== ''
      }),
  )
