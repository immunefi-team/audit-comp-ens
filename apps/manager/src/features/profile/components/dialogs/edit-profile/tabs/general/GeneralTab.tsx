import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import type { Address } from 'viem'
import { MSymbol } from '@/components/ui/material-symbol'
import type { PreparedProfileImageUpload } from '@/features/profile/service/profileImageUpload'
import type { ProfileRecords, TextRecordValue } from '@/features/profile/types'
import { cn } from '@/lib/utils'
import {
  useEditProfileDialogActions,
  useEditProfileDialogStatus,
  useEditProfileVisibleFields,
} from '../../EditProfileDialog.context'
import { FieldPickerPill } from '../../shared/FieldPickerPill'
import {
  type GeneralField,
  generalShortcuts,
  getGeneralUrlErrorMessage,
  getTextRecordValue,
  removeGeneralFieldValue,
} from './fields'
import { ProfileImageField, type ProfileImageKind } from './ProfileImageField'
import { profileLanguageOptions } from './profileLanguages'

type BaseGeneralField = Extract<GeneralField, keyof ProfileRecords['base']>

const timezoneSelectOptions = Array.from({ length: 27 }, (_, index) => {
  const offset = index - 12
  const value = `UTC${offset >= 0 ? `+${offset}` : offset}`
  return { label: value, value }
})

const setTextRecordValue = (
  records: readonly TextRecordValue[],
  key: string,
  value: string,
): TextRecordValue[] => {
  const nextRecords = records.filter((record) => record.key !== key)
  return value.trim() === '' ? nextRecords : [...nextRecords, { key, value }]
}

const fieldClassName =
  'w-full rounded-sm border border-[#d4d4d4] bg-transparent p-4 text-[16px] text-ens-quartz-900 outline-none transition-colors placeholder:text-ens-quartz-400 focus-visible:border-ens-lapis-500 disabled:pointer-events-none disabled:opacity-50'

const urlErrorMessageId = 'general-url-error-message'
const mobileHiddenShortcutFields: ReadonlySet<GeneralField> = new Set([
  'name',
  'url',
])

interface UrlFieldProps {
  readonly disabled: boolean
  readonly errorMessage?: string
  readonly onChange: (value: string) => void
  readonly value: string
}

const UrlField = ({
  disabled,
  errorMessage,
  onChange,
  value,
}: UrlFieldProps) => (
  <div className="flex w-full flex-col gap-1.5">
    <input
      aria-describedby={errorMessage ? urlErrorMessageId : undefined}
      aria-invalid={Boolean(errorMessage)}
      className={cn(
        fieldClassName,
        errorMessage && 'border-destructive focus-visible:border-destructive',
      )}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      placeholder="https://yourwebsite.com"
      value={value}
    />
    {errorMessage ? (
      <p
        className="flex items-start gap-1 text-ens-signal-danger-600 text-xs leading-[1.2]"
        id={urlErrorMessageId}
        role="alert"
      >
        <MSymbol
          aria-hidden="true"
          className="ms-opsz-12 ms-wght-400 mt-px shrink-0"
          symbol="warning"
        />
        <span>{errorMessage}</span>
      </p>
    ) : null}
  </div>
)

interface SelectFieldProps {
  readonly ariaLabel: string
  readonly disabled?: boolean
  readonly onChange: (value: string) => void
  readonly options: readonly {
    readonly label: string
    readonly value: string
  }[]
  readonly placeholder: string
  readonly value: string
}

const SelectField = ({
  ariaLabel,
  disabled,
  onChange,
  options,
  placeholder,
  value,
}: SelectFieldProps) => {
  const hasCustomValue =
    value.trim() !== '' && !options.some((option) => option.value === value)

  return (
    <div className="relative">
      <select
        aria-label={ariaLabel}
        className={cn(
          fieldClassName,
          'appearance-none pr-12',
          value ? 'text-ens-quartz-900' : 'text-ens-quartz-400',
        )}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">{placeholder}</option>
        {hasCustomValue && <option value={value}>{value}</option>}
        {options.map(({ label, value: optionValue }) => (
          <option key={optionValue} value={optionValue}>
            {label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-ens-quartz-400" />
    </div>
  )
}

interface GeneralTabProps {
  readonly name: string
  readonly onBaseChange: (base: ProfileRecords['base']) => void
  readonly onContactChange: (contact: ProfileRecords['contact']) => void
  readonly onImageUploadPrepared?: (upload: PreparedProfileImageUpload) => void
  readonly owner?: Address
  readonly preparedImageUploads: readonly PreparedProfileImageUpload[]
  readonly values: ProfileRecords
}

export const GeneralTab = ({
  name,
  onBaseChange,
  onContactChange,
  onImageUploadPrepared,
  owner,
  preparedImageUploads,
  values,
}: GeneralTabProps) => {
  const { isSaving } = useEditProfileDialogStatus()
  const visibleFields = useEditProfileVisibleFields()
  const { showField, toggleField } = useEditProfileDialogActions()
  const [activeImageField, setActiveImageField] =
    useState<ProfileImageKind | null>(null)
  const isVisible = (field: GeneralField) => visibleFields.has(field)
  const setBaseValue = (key: BaseGeneralField, value: string) =>
    onBaseChange({ ...values.base, [key]: value })
  const removeFieldValue = (field: GeneralField) => {
    const currentValues = values
    const nextValues = removeGeneralFieldValue(currentValues, field)

    if (nextValues.base !== currentValues.base) {
      onBaseChange(nextValues.base)
    }

    if (nextValues.contact !== currentValues.contact) {
      onContactChange(nextValues.contact)
    }
  }
  const getPreparedImagePreviewUrl = (kind: ProfileImageKind) =>
    preparedImageUploads.find(
      (upload) => upload.kind === kind && upload.imageUrl === values.base[kind],
    )?.dataURL
  const urlErrorMessage = getGeneralUrlErrorMessage(values.base.url)
  const getShortcutLabel = (field: GeneralField, label: string) => {
    if (field === 'avatar') {
      return (
        <>
          <span className="md:hidden">Avatar</span>
          <span className="hidden md:inline">{label}</span>
        </>
      )
    }

    if (field === 'header') {
      return (
        <>
          <span className="md:hidden">Header</span>
          <span className="hidden md:inline">{label}</span>
        </>
      )
    }

    return label
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <p className="font-bold font-sans text-[#525252] text-[16px] leading-[0.96] tracking-[-0.32px]">
        General
      </p>

      <div className="flex flex-wrap gap-2">
        {generalShortcuts.map(({ field, label, ...shortcut }) => {
          const active = isVisible(field)
          return (
            <FieldPickerPill
              active={active}
              className={cn(
                mobileHiddenShortcutFields.has(field) && 'hidden md:flex',
              )}
              icon={
                <MSymbol
                  className="ms-opsz-20 ms-wght-400 shrink-0 text-current text-sm"
                  symbol={shortcut.symbol}
                />
              }
              key={field}
              label={getShortcutLabel(field, label)}
              onClick={() => {
                if (active) {
                  removeFieldValue(field)
                }
                toggleField(field)
                if (field === activeImageField) {
                  setActiveImageField(null)
                }
              }}
            />
          )
        })}
      </div>

      <div className="flex flex-col items-center gap-3">
        {isVisible('avatar') && (
          <ProfileImageField
            currentImage={values.base.avatar}
            disabled={isSaving}
            isActive={activeImageField === 'avatar'}
            kind="avatar"
            name={name}
            onActivate={() => setActiveImageField('avatar')}
            onCancel={() => setActiveImageField(null)}
            onImageChange={(imageUrl) => setBaseValue('avatar', imageUrl)}
            onImageRemove={() => setBaseValue('avatar', '')}
            onImageUploadPrepared={onImageUploadPrepared}
            owner={owner}
            preparedImagePreviewUrl={getPreparedImagePreviewUrl('avatar')}
            themeColor={values.base.theme}
          />
        )}

        {isVisible('header') && (
          <ProfileImageField
            currentImage={values.base.header}
            disabled={isSaving}
            isActive={activeImageField === 'header'}
            kind="header"
            name={name}
            onActivate={() => setActiveImageField('header')}
            onCancel={() => setActiveImageField(null)}
            onImageChange={(imageUrl) => setBaseValue('header', imageUrl)}
            onImageRemove={() => setBaseValue('header', '')}
            onImageUploadPrepared={onImageUploadPrepared}
            preparedImagePreviewUrl={getPreparedImagePreviewUrl('header')}
          />
        )}

        <input
          className={cn(fieldClassName, !isVisible('name') && 'md:hidden')}
          disabled={isSaving}
          onChange={(event) => {
            showField('name')
            setBaseValue('name', event.target.value)
          }}
          placeholder="Full name"
          value={values.base.name ?? ''}
        />

        {isVisible('description') && (
          <textarea
            className={cn(fieldClassName, 'min-h-[101px] resize-none')}
            disabled={isSaving}
            onChange={(event) =>
              setBaseValue('description', event.target.value)
            }
            placeholder="Description"
            value={values.base.description ?? ''}
          />
        )}

        {isVisible('url') && (
          <div className="hidden w-full md:block">
            <UrlField
              disabled={isSaving}
              errorMessage={urlErrorMessage}
              onChange={(value) => setBaseValue('url', value)}
              value={values.base.url ?? ''}
            />
          </div>
        )}

        {(isVisible('timezone') || isVisible('language')) && (
          <div className="grid w-full grid-cols-2 gap-3">
            {isVisible('timezone') && (
              <SelectField
                ariaLabel="Timezone"
                disabled={isSaving}
                onChange={(value) =>
                  onContactChange(
                    setTextRecordValue(values.contact, 'timezone', value),
                  )
                }
                options={timezoneSelectOptions}
                placeholder="Timezone"
                value={getTextRecordValue(values.contact, 'timezone')}
              />
            )}
            {isVisible('language') && (
              <SelectField
                ariaLabel="Language"
                disabled={isSaving}
                onChange={(value) => setBaseValue('language', value)}
                options={profileLanguageOptions}
                placeholder="Language"
                value={values.base.language ?? ''}
              />
            )}
          </div>
        )}

        {isVisible('location') && (
          <input
            className={fieldClassName}
            disabled={isSaving}
            onChange={(event) =>
              onContactChange(
                setTextRecordValue(
                  values.contact,
                  'location',
                  event.target.value,
                ),
              )
            }
            placeholder="Location"
            value={getTextRecordValue(values.contact, 'location')}
          />
        )}
      </div>
    </div>
  )
}
