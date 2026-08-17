import type React from 'react'
import { PatternAvatar } from '@/components/atoms/PatternAvatar/PatternAvatar'
import { MSymbol } from '@/components/ui/material-symbol'
import type { AvatarNft } from '@/features/profile/service/profileNfts'
import { safeImageSrc } from '@/features/profile/utils/safeUrl'
import { getThemeVars } from '@/features/profile/utils/themeColor'
import { cn } from '@/lib/utils'
import {
  fieldShellClassName,
  focusVisibleRingClassName,
  getTitle,
} from './ProfileImageField.helpers'
import type { ProfileImageKind } from './ProfileImageField.types'
import { ErrorMessage } from './ProfileImageFieldPanels'
import { DisplayImage } from './ProfileImagePreview'

interface BackButtonProps {
  readonly disabled?: boolean
  readonly onBack: () => void
}

const BackButton = ({ disabled, onBack }: BackButtonProps) => (
  <button
    aria-label="Back to image options"
    className={cn(
      'absolute top-1.5 left-1.5 flex size-12 items-center justify-center rounded-sm border border-ens-quartz-200 bg-white text-ens-quartz-500 transition-colors hover:bg-ens-quartz-50 disabled:pointer-events-none disabled:opacity-50',
      focusVisibleRingClassName,
    )}
    disabled={disabled}
    onClick={onBack}
    type="button"
  >
    <MSymbol aria-hidden="true" style={{ fontSize: 20 }} symbol="arrow_back" />
  </button>
)

interface ImagePickerPanelProps {
  readonly backDisabled?: boolean
  readonly children: React.ReactNode
  readonly className?: string
  readonly contentClassName?: string
  readonly onBack: () => void
}

export const ImagePickerPanel = ({
  backDisabled,
  children,
  className,
  contentClassName,
  onBack,
}: ImagePickerPanelProps) => (
  <div
    className={cn(
      'relative flex w-full items-start justify-center',
      fieldShellClassName,
      className,
    )}
  >
    <BackButton disabled={backDisabled} onBack={onBack} />
    <div className={cn('flex w-full flex-col items-center', contentClassName)}>
      {children}
    </div>
  </div>
)

const StepPanel = ({
  backDisabled,
  children,
  onBack,
}: Pick<ImagePickerPanelProps, 'backDisabled' | 'children' | 'onBack'>) => (
  <ImagePickerPanel
    backDisabled={backDisabled}
    className="min-h-60 p-4"
    contentClassName="max-w-95 gap-4 pt-2"
    onBack={onBack}
  >
    {children}
  </ImagePickerPanel>
)

const NftStepPanel = ({
  backDisabled,
  children,
  onBack,
}: Pick<ImagePickerPanelProps, 'backDisabled' | 'children' | 'onBack'>) => (
  <ImagePickerPanel
    backDisabled={backDisabled}
    className="min-h-85 overflow-hidden p-1.5"
    contentClassName="gap-3 pt-4"
    onBack={onBack}
  >
    {children}
  </ImagePickerPanel>
)

const editPreviewClassName = (kind: ProfileImageKind) =>
  cn(
    kind === 'avatar' ? 'size-40 rounded-xl' : 'h-31.5 w-full rounded-sm',
    'object-cover',
  )

interface ManualInputStepProps {
  readonly disabled?: boolean
  readonly error: string | null
  readonly manualUrl: string
  readonly onBack: () => void
  readonly onManualUrlChange: (url: string) => void
  readonly onPreviewManualUrl: () => void
}

export const ManualInputStep = ({
  disabled,
  error,
  manualUrl,
  onBack,
  onManualUrlChange,
  onPreviewManualUrl,
}: ManualInputStepProps) => (
  <StepPanel backDisabled={disabled} onBack={onBack}>
    <p className="text-base text-ens-quartz-500 leading-ens-normal">
      Enter manually
    </p>
    <p className="max-w-72.5 text-center text-ens-quartz-400 text-xs leading-ens-normal">
      Paste an image URL. Supported formats include JPG, PNG, GIF, and WebP.
    </p>
    <input
      aria-label="Image URL"
      className={cn(
        'h-10 w-full rounded-sm border border-ens-quartz-250 bg-transparent px-3 text-ens-quartz-900 text-xs outline-none transition-colors placeholder:text-ens-quartz-350 focus-visible:border-ens-lapis-500',
        focusVisibleRingClassName,
      )}
      disabled={disabled}
      onChange={(event) => onManualUrlChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          onPreviewManualUrl()
        }
      }}
      placeholder="https://example.com/image.jpg"
      value={manualUrl}
    />
    <button
      className={cn(
        'flex h-10 items-center justify-center rounded-sm bg-ens-lapis-100 px-5 font-mono text-ens-lapis-500 text-xs uppercase tracking-widest transition-colors hover:bg-ens-lapis-100/80 disabled:pointer-events-none disabled:opacity-50',
        focusVisibleRingClassName,
      )}
      disabled={disabled || manualUrl.trim() === ''}
      onClick={onPreviewManualUrl}
      type="button"
    >
      Confirm
    </button>
    <ErrorMessage error={error} />
  </StepPanel>
)

interface ManualPreviewStepProps {
  readonly disabled?: boolean
  readonly error: string | null
  readonly kind: ProfileImageKind
  readonly manualUrl: string
  readonly onBack: () => void
  readonly onImageError: () => void
  readonly onUseImage: () => void
}

export const ManualPreviewStep = ({
  disabled,
  error,
  kind,
  manualUrl,
  onBack,
  onImageError,
  onUseImage,
}: ManualPreviewStepProps) => {
  const src = safeImageSrc(manualUrl)
  return (
    <StepPanel backDisabled={disabled} onBack={onBack}>
      <p className="text-base text-ens-quartz-500 leading-ens-normal">
        Preview image
      </p>
      {src ? (
        <img
          alt="Manual URL preview"
          className={editPreviewClassName(kind)}
          onError={onImageError}
          src={src}
        />
      ) : null}
      <button
        className={cn(
          'flex h-10 items-center justify-center rounded-sm bg-ens-lapis-100 px-5 font-mono text-ens-lapis-500 text-xs uppercase tracking-widest transition-colors hover:bg-ens-lapis-100/80 disabled:pointer-events-none disabled:opacity-50',
          focusVisibleRingClassName,
        )}
        disabled={disabled}
        onClick={onUseImage}
        type="button"
      >
        Use image
      </button>
      <ErrorMessage error={error} />
    </StepPanel>
  )
}

interface NftSelectionStepProps {
  readonly disabled?: boolean
  readonly error: string | null
  readonly isLoading: boolean
  readonly nfts: readonly AvatarNft[]
  readonly nftOwnerAddress?: string
  readonly onBack: () => void
  readonly onSearchChange: (query: string) => void
  readonly onSelectNft: (nft: AvatarNft) => void
  readonly searchQuery: string
}

export const NftSelectionStep = ({
  disabled,
  error,
  isLoading,
  nfts,
  nftOwnerAddress,
  onBack,
  onSearchChange,
  onSelectNft,
  searchQuery,
}: NftSelectionStepProps) => {
  const emptyMessage = searchQuery.trim()
    ? 'No NFTs match your search.'
    : 'No NFTs found for this wallet on this network.'
  const nftStatusClassName =
    'flex min-h-32 w-full max-w-135 items-center justify-center rounded-sm border border-ens-quartz-250 border-dashed p-4 text-center text-ens-quartz-400 text-xs leading-ens-normal'
  const renderNftContent = () => {
    if (!nftOwnerAddress) {
      return (
        <p className={nftStatusClassName}>
          Unable to determine wallet address for NFT lookup.
        </p>
      )
    }

    if (isLoading) {
      return <p className={nftStatusClassName}>Loading NFTs...</p>
    }

    if (nfts.length === 0) {
      return <p className={nftStatusClassName}>{emptyMessage}</p>
    }

    return (
      <div className="flex max-h-58 w-full max-w-135 flex-wrap items-start justify-center gap-x-4 gap-y-5 overflow-y-auto px-2 pt-3">
        {nfts.map((nft) => (
          <button
            className={cn(
              'w-18.5 rounded-sm text-center transition-opacity hover:opacity-80 disabled:pointer-events-none disabled:opacity-50',
              focusVisibleRingClassName,
            )}
            disabled={disabled}
            key={nft.id}
            onClick={() => onSelectNft(nft)}
            type="button"
          >
            <DisplayImage
              alt={nft.name}
              className="mx-auto size-18.5 rounded-md object-cover"
              fallback={
                <PatternAvatar
                  className="mx-auto size-18.5 rounded-md border-none bg-transparent p-0 shadow-none"
                  name={nft.name}
                />
              }
              src={nft.image}
            />
            <p className="mt-1 truncate text-center text-ens-quartz-500 text-xs leading-ens-normal">
              {nft.name}
            </p>
          </button>
        ))}
      </div>
    )
  }

  return (
    <NftStepPanel backDisabled={disabled} onBack={onBack}>
      <p className="text-center text-ens-quartz-500 text-sm leading-ens-normal">
        Choose an NFT
      </p>
      <div
        className={cn(
          'flex h-9 w-full max-w-92 items-center gap-2 rounded-full bg-ens-quartz-50 px-3 text-ens-quartz-400 transition-colors focus-within:bg-white focus-within:ring-1 focus-within:ring-ens-lapis-500',
          focusVisibleRingClassName,
        )}
      >
        <MSymbol aria-hidden="true" style={{ fontSize: 20 }} symbol="search" />
        <input
          aria-label="Search NFTs"
          className="h-full min-w-0 flex-1 bg-transparent text-ens-quartz-900 text-xs outline-none placeholder:text-ens-quartz-350"
          disabled={disabled || !nftOwnerAddress}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search my NFTS"
          value={searchQuery}
        />
      </div>
      <ErrorMessage error={error} />
      {renderNftContent()}
    </NftStepPanel>
  )
}

interface NftConfirmationStepProps {
  readonly disabled?: boolean
  readonly nft: AvatarNft | null
  readonly onBack: () => void
  readonly onUseNft: () => void
}

export const NftConfirmationStep = ({
  disabled,
  nft,
  onBack,
  onUseNft,
}: NftConfirmationStepProps) => {
  if (!nft) return null

  return (
    <NftStepPanel backDisabled={disabled} onBack={onBack}>
      <p className="text-center text-ens-quartz-500 text-sm leading-ens-normal">
        Use this NFT?
      </p>
      <DisplayImage
        alt={nft.name}
        className="size-50 rounded-md object-cover"
        fallback={
          <PatternAvatar
            className="size-50 rounded-md border-none bg-transparent p-0 shadow-none"
            name={nft.name}
          />
        }
        src={nft.image}
      />
      <div className="max-w-[320px] text-center">
        <p className="truncate text-ens-quartz-700 text-sm leading-ens-normal">
          {nft.name}
        </p>
        <p className="truncate text-ens-quartz-400 text-xs leading-ens-normal">
          {nft.collection}
        </p>
      </div>
      <button
        className={cn(
          'flex h-10 items-center justify-center rounded-sm bg-ens-lapis-100 px-5 font-mono text-ens-lapis-500 text-xs uppercase tracking-widest transition-colors hover:bg-ens-lapis-100/80 disabled:pointer-events-none disabled:opacity-50',
          focusVisibleRingClassName,
        )}
        disabled={disabled}
        onClick={onUseNft}
        type="button"
      >
        Use NFT
      </button>
    </NftStepPanel>
  )
}

interface RemoveConfirmationStepProps {
  readonly disabled?: boolean
  readonly displayImage?: string | null
  readonly kind: ProfileImageKind
  readonly name: string
  readonly onBack: () => void
  readonly onConfirm: () => void
  readonly themeColor?: string | null
}

export const RemoveConfirmationStep = ({
  disabled,
  displayImage,
  kind,
  name,
  onBack,
  onConfirm,
  themeColor,
}: RemoveConfirmationStepProps) => {
  const avatarThemeColor = getThemeVars(themeColor)['--theme-color']

  return (
    <StepPanel backDisabled={disabled} onBack={onBack}>
      <p className="max-w-80 text-center text-ens-quartz-400 text-xs leading-ens-normal">
        Remove current {getTitle(kind)} and replace it with your generated
        profile default.
      </p>
      <div className="flex items-center gap-8">
        <DisplayImage
          alt={`Current ${getTitle(kind)}`}
          className={cn(
            kind === 'avatar' ? 'size-25 rounded-xl' : 'h-21 w-37.5 rounded-sm',
            'object-cover',
          )}
          fallback={
            kind === 'avatar' ? (
              <PatternAvatar
                className="size-25 rounded-xl border-none bg-transparent p-0 shadow-none"
                color={avatarThemeColor}
                name={name}
              />
            ) : (
              <div className="flex size-25 items-center justify-center rounded-sm bg-ens-quartz-100 text-ens-quartz-400">
                <MSymbol
                  aria-hidden="true"
                  style={{ fontSize: 28 }}
                  symbol="wall_art"
                />
              </div>
            )
          }
          src={displayImage}
        />
        <MSymbol
          aria-hidden="true"
          className="text-ens-quartz-400"
          style={{ fontSize: 22 }}
          symbol="arrow_forward"
        />
        <div
          className={cn(
            kind === 'avatar' ? 'size-25 rounded-xl' : 'h-21 w-37.5 rounded-sm',
            'bg-ens-quartz-100',
          )}
        >
          {kind === 'avatar' ? (
            <PatternAvatar
              className="size-full rounded-xl border-none bg-transparent p-0 shadow-none"
              color={avatarThemeColor}
              name={name}
            />
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          className={cn(
            'h-10 rounded-sm px-5 font-mono text-ens-quartz-700 text-xs uppercase tracking-widest transition-colors hover:bg-ens-quartz-100 disabled:pointer-events-none disabled:opacity-50',
            focusVisibleRingClassName,
          )}
          disabled={disabled}
          onClick={onBack}
          type="button"
        >
          Cancel
        </button>
        <button
          className={cn(
            'h-10 rounded-sm bg-ens-lapis-100 px-5 font-mono text-ens-lapis-500 text-xs uppercase tracking-widest transition-colors hover:bg-ens-lapis-100/80 disabled:pointer-events-none disabled:opacity-50',
            focusVisibleRingClassName,
          )}
          disabled={disabled}
          onClick={onConfirm}
          type="button"
        >
          Remove
        </button>
      </div>
    </StepPanel>
  )
}
