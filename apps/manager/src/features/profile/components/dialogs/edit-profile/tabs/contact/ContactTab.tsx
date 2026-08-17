import { useState } from 'react'
import { IconRenderer } from '@/features/profile/components/IconRenderer'
import { getRecordDef } from '@/features/profile/data/records'
import type { ProfileRecords, TextRecordValue } from '@/features/profile/types'
import { useEditProfileDialogStatus } from '../../EditProfileDialog.context'
import { FieldPickerPill } from '../../shared/FieldPickerPill'
import { ContactMethodRow } from './ContactMethodRow'
import {
  type ContactMethod,
  type ContactMethodKey,
  contactMethods,
  defaultEnabledContactMethodKeys,
  maxPrimaryContactMethods,
  rowMethods,
} from './constants'
import { PrimaryContactCapacityIndicator } from './PrimaryContactCapacityIndicator'
import {
  getBaseWithPrimaryContactKeys,
  getContactMethodErrorMessage,
  getContactMethodNoticeMessage,
  getIsPrimaryContactToggleDisabled,
  getRecordsForMethod,
  getRecordValue,
  hasRecord,
  parsePrimaryContactKeys,
  removeRecord,
  upsertRecordValue,
} from './records'

interface ContactTabProps {
  readonly onBaseChange: (base: ProfileRecords['base']) => void
  readonly onContactChange: (contact: ProfileRecords['contact']) => void
  readonly onSocialChange: (social: ProfileRecords['social']) => void
  readonly values: ProfileRecords
}

export const ContactTab = ({
  onBaseChange,
  onContactChange,
  onSocialChange,
  values,
}: ContactTabProps) => {
  const { isSaving } = useEditProfileDialogStatus()
  const [disabledDefaultMethodKeys, setDisabledDefaultMethodKeys] = useState<
    ReadonlySet<ContactMethodKey>
  >(() => new Set())
  const primaryContactKeys = parsePrimaryContactKeys(values.base)

  const isDefaultEnabledMethod = (method: ContactMethod) =>
    defaultEnabledContactMethodKeys.has(method.key) &&
    !disabledDefaultMethodKeys.has(method.key)
  const isMethodEnabled = (method: ContactMethod) =>
    hasRecord(values, method) || isDefaultEnabledMethod(method)

  const selectedMethods = rowMethods.filter((method) => isMethodEnabled(method))
  const selectedPrimaryContactCount = primaryContactKeys.length

  const updatePrimaryContactKeys = (keys: readonly ContactMethodKey[]) => {
    onBaseChange(getBaseWithPrimaryContactKeys(values.base, keys))
  }

  const removePrimaryContact = (method: ContactMethod) => {
    if (!primaryContactKeys.includes(method.key)) return

    updatePrimaryContactKeys(
      primaryContactKeys.filter((key) => key !== method.key),
    )
  }

  const updateRecords = (method: ContactMethod, records: TextRecordValue[]) => {
    if (method.section === 'contact') {
      onContactChange(records)
      return
    }

    onSocialChange(records)
  }

  const handlePickerToggle = (method: ContactMethod) => {
    const records = getRecordsForMethod(values, method)
    const defaultEnabled = defaultEnabledContactMethodKeys.has(method.key)

    if (isMethodEnabled(method)) {
      if (hasRecord(values, method)) {
        updateRecords(method, removeRecord(records, method.key))
      }

      if (defaultEnabled) {
        setDisabledDefaultMethodKeys((current) => {
          const next = new Set(current)
          next.add(method.key)
          return next
        })
      }

      removePrimaryContact(method)
      return
    }

    if (defaultEnabled) {
      setDisabledDefaultMethodKeys((current) => {
        const next = new Set(current)
        next.delete(method.key)
        return next
      })
      return
    }

    updateRecords(method, upsertRecordValue(records, method.key, ''))
  }

  const handleValueChange = (method: ContactMethod, value: string) => {
    const records = getRecordsForMethod(values, method)
    updateRecords(method, upsertRecordValue(records, method.key, value))
  }

  const handlePrimaryChange = (method: ContactMethod, checked: boolean) => {
    if (!checked) {
      removePrimaryContact(method)
      return
    }

    if (
      primaryContactKeys.includes(method.key) ||
      primaryContactKeys.length >= maxPrimaryContactMethods
    ) {
      return
    }

    updatePrimaryContactKeys([...primaryContactKeys, method.key])
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex flex-col gap-1.5">
        <p className="font-bold font-sans text-[#525252] text-[16px] leading-[0.96] tracking-[-0.32px]">
          Contact and Social
        </p>
        <p className="text-[16px] text-ens-quartz-400 leading-[1.2]">
          Add the places people can find or reach you. Toggle up to 3 as your
          primary contact methods — these get pinned to the top of your profile.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {contactMethods.map((method) => {
          const active = isMethodEnabled(method)
          const record = getRecordDef(method.key)

          return (
            <FieldPickerPill
              active={active}
              disabled={isSaving}
              icon={
                <IconRenderer
                  className="size-3 shrink-0 text-current"
                  icon={record?.icon}
                />
              }
              key={method.key}
              label={method.label}
              onClick={() => handlePickerToggle(method)}
            />
          )
        })}
      </div>

      <div className="relative flex flex-col gap-3">
        <div className="absolute -top-5.5 right-0">
          <PrimaryContactCapacityIndicator
            maximum={maxPrimaryContactMethods}
            selected={selectedPrimaryContactCount}
          />
        </div>

        {selectedMethods.length === 0 ? (
          <div className="rounded-sm border border-ens-quartz-250 border-dashed p-4 text-[14px] text-ens-quartz-400">
            Select a contact method to add it to your profile.
          </div>
        ) : (
          selectedMethods.map((method) => {
            const value = getRecordValue(values, method)
            const primary = primaryContactKeys.includes(method.key)

            return (
              <ContactMethodRow
                disabled={isSaving}
                errorMessage={getContactMethodErrorMessage({
                  isPrimary: primary,
                  method,
                  value,
                })}
                key={method.key}
                method={method}
                noticeMessage={getContactMethodNoticeMessage(method)}
                onPrimaryChange={handlePrimaryChange}
                onValueChange={handleValueChange}
                primary={primary}
                primaryDisabled={getIsPrimaryContactToggleDisabled({
                  isPrimary: primary,
                  primaryContactCount: primaryContactKeys.length,
                })}
                value={value}
              />
            )
          })
        )}
      </div>
    </div>
  )
}
