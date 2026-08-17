import type React from 'react'
import { type MaterialSymbol, MSymbol } from '@/components/ui/material-symbol'
import { cn } from '@/lib/utils'
import {
  dropZoneClassName,
  focusVisibleRingClassName,
  getChangeLabel,
  getEmptyLabel,
  getTitle,
} from './ProfileImageField.helpers'
import type { ProfileImageKind } from './ProfileImageField.types'
import { ProfileImagePreview } from './ProfileImagePreview'

interface ErrorMessageProps {
  readonly error: string | null
}

export const ErrorMessage = ({ error }: ErrorMessageProps) => {
  if (!error) return null

  return (
    <p
      className="text-center text-ens-signal-danger-600 text-xs leading-ens-normal"
      role="alert"
    >
      {error}
    </p>
  )
}

interface ProfileImageActionProps {
  readonly disabled?: boolean
  readonly icon: MaterialSymbol
  readonly label: string
  readonly onClick: () => void
}

// Mobile action labels need raw 10px/1.2px values to fit the compact row;
// desktop switches back to Tailwind text/tracking tokens.
const actionTextClassName =
  'font-mono text-ens-lapis-500 text-[10px] uppercase leading-none tracking-[1.2px] md:text-xs md:tracking-widest'

const ProfileImageAction = ({
  disabled,
  icon,
  label,
  onClick,
}: ProfileImageActionProps) => (
  <button
    className={cn(
      'flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-ens-lapis-100/50 disabled:pointer-events-none disabled:opacity-45',
      focusVisibleRingClassName,
    )}
    disabled={disabled}
    onClick={onClick}
    type="button"
  >
    <MSymbol
      aria-hidden="true"
      className="text-ens-lapis-900"
      style={{ fontSize: 14 }}
      symbol={icon}
    />
    <span className={actionTextClassName}>{label}</span>
  </button>
)

interface ImagePreviewProps {
  readonly displayImage?: string | null
  readonly hasImage: boolean
  readonly kind: ProfileImageKind
  readonly name: string
  readonly themeColor?: string | null
}

interface DefaultImageFieldProps extends ImagePreviewProps {
  readonly disabled?: boolean
  readonly onActivate: () => void
  readonly onDragOver: (event: React.DragEvent) => void
  readonly onDrop: (event: React.DragEvent) => void
}

export const DefaultImageField = ({
  disabled,
  displayImage,
  hasImage,
  kind,
  name,
  onActivate,
  onDragOver,
  onDrop,
  themeColor,
}: DefaultImageFieldProps) => (
  <button
    className={cn(
      'flex w-full items-center justify-center overflow-hidden p-3 transition-colors hover:border-ens-quartz-350 focus-visible:border-ens-lapis-500 disabled:pointer-events-none disabled:opacity-50',
      kind === 'avatar' ? 'h-38 md:h-42' : 'h-27 md:h-42',
      dropZoneClassName,
      focusVisibleRingClassName,
    )}
    disabled={disabled}
    onClick={onActivate}
    onDragOver={onDragOver}
    onDrop={onDrop}
    title={`Edit ${getTitle(kind)}`}
    type="button"
  >
    {kind === 'avatar' ? (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2.5 md:w-43.5 md:gap-3.5">
        <ProfileImagePreview
          displayImage={displayImage}
          hasImage={hasImage}
          kind={kind}
          name={name}
          themeColor={themeColor}
        />
        <span className="flex items-center gap-1 text-ens-quartz-400 text-xs md:gap-2 md:text-sm">
          {hasImage ? getChangeLabel(kind) : getEmptyLabel(kind)}
          <MSymbol
            aria-hidden="true"
            className={cn(!hasImage && 'ms-fill')}
            style={{ fontSize: 14 }}
            symbol={hasImage ? 'edit' : 'add'}
          />
        </span>
      </div>
    ) : (
      <ProfileImagePreview
        displayImage={displayImage}
        hasImage={hasImage}
        kind={kind}
        name={name}
        themeColor={themeColor}
      />
    )}
  </button>
)

interface CancelPreviewButtonProps extends ImagePreviewProps {
  readonly disabled?: boolean
  readonly onCancel: () => void
  readonly onDragOver: (event: React.DragEvent) => void
  readonly onDrop: (event: React.DragEvent) => void
}

const CancelPreviewButton = ({
  disabled,
  displayImage,
  hasImage,
  kind,
  name,
  onCancel,
  onDragOver,
  onDrop,
  themeColor,
}: CancelPreviewButtonProps) => {
  if (kind === 'avatar') {
    return (
      <button
        className={cn(
          'flex h-38 w-full shrink-0 flex-col items-center justify-center gap-2.5 rounded-sm border border-ens-quartz-250 border-dashed bg-ens-quartz-50 py-3 text-ens-quartz-400 disabled:pointer-events-none disabled:opacity-50 md:h-42 md:w-43.5 md:gap-3.5 md:border-none md:bg-transparent',
          focusVisibleRingClassName,
        )}
        disabled={disabled}
        onClick={onCancel}
        type="button"
      >
        <ProfileImagePreview
          displayImage={displayImage}
          hasImage={hasImage}
          kind={kind}
          name={name}
          themeColor={themeColor}
        />
        <span className="flex items-center gap-2 text-xs md:text-sm">
          Cancel
          <MSymbol aria-hidden="true" style={{ fontSize: 14 }} symbol="close" />
        </span>
      </button>
    )
  }

  return (
    <button
      className={cn(
        'flex h-27 w-full items-center justify-center overflow-hidden p-3 text-ens-quartz-500 disabled:pointer-events-none disabled:opacity-50 md:h-42 md:min-w-0 md:flex-1',
        dropZoneClassName,
        focusVisibleRingClassName,
      )}
      disabled={disabled}
      onClick={onCancel}
      onDragOver={onDragOver}
      onDrop={onDrop}
      type="button"
    >
      {hasImage ? (
        <ProfileImagePreview
          displayImage={displayImage}
          hasImage={hasImage}
          kind={kind}
          name={name}
          themeColor={themeColor}
        />
      ) : (
        <span className="flex items-center gap-2 text-xs md:text-sm">
          Cancel
          <MSymbol aria-hidden="true" style={{ fontSize: 14 }} symbol="close" />
        </span>
      )}
    </button>
  )
}

interface ImageActionPanelProps {
  readonly disabled?: boolean
  readonly error: string | null
  readonly onManual: () => void
  readonly onNft?: () => void
  readonly onRemove: () => void
  readonly onUpload: () => void
}

const ImageActionPanel = ({
  disabled,
  error,
  onManual,
  onNft,
  onRemove,
  onUpload,
}: ImageActionPanelProps) => (
  <div
    className={cn(
      'flex h-42 w-full items-center justify-center p-4 md:min-w-0 md:flex-1',
      'md:rounded-sm md:border md:border-ens-quartz-250 md:bg-white',
    )}
  >
    <div className="flex flex-col items-start">
      <ProfileImageAction
        disabled={disabled}
        icon="upload"
        label="Upload image"
        onClick={onUpload}
      />
      {onNft ? (
        <ProfileImageAction
          disabled={disabled}
          icon="account_balance_wallet"
          label="Choose NFT"
          onClick={onNft}
        />
      ) : null}
      <ProfileImageAction
        disabled={disabled}
        icon="text_fields_alt"
        label="Enter manually"
        onClick={onManual}
      />
      <ProfileImageAction
        disabled={disabled}
        icon="remove"
        label="Remove"
        onClick={onRemove}
      />
      <ErrorMessage error={error} />
    </div>
  </div>
)

interface ActiveImageOptionsProps extends ImagePreviewProps {
  readonly disabled?: boolean
  readonly error: string | null
  readonly onCancel: () => void
  readonly onDragOver: (event: React.DragEvent) => void
  readonly onDrop: (event: React.DragEvent) => void
  readonly onManual: () => void
  readonly onNft?: () => void
  readonly onRemove: () => void
  readonly onUpload: () => void
}

export const ActiveImageOptions = ({
  disabled,
  displayImage,
  error,
  hasImage,
  kind,
  name,
  onCancel,
  onDragOver,
  onDrop,
  onManual,
  onNft,
  onRemove,
  onUpload,
  themeColor,
}: ActiveImageOptionsProps) => (
  <div className="flex w-full flex-col gap-3 md:flex-row">
    <CancelPreviewButton
      disabled={disabled}
      displayImage={displayImage}
      hasImage={hasImage}
      kind={kind}
      name={name}
      onCancel={onCancel}
      onDragOver={onDragOver}
      onDrop={onDrop}
      themeColor={themeColor}
    />
    <ImageActionPanel
      disabled={disabled}
      error={error}
      onManual={onManual}
      onNft={kind === 'avatar' ? onNft : undefined}
      onRemove={onRemove}
      onUpload={onUpload}
    />
  </div>
)
