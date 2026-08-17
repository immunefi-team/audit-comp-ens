import { UploadCropStep } from './ProfileImageCropper'
import type { ProfileImageFieldProps } from './ProfileImageField.types'
import {
  ActiveImageOptions,
  DefaultImageField,
} from './ProfileImageFieldPanels'
import {
  ManualInputStep,
  ManualPreviewStep,
  NftConfirmationStep,
  NftSelectionStep,
  RemoveConfirmationStep,
} from './ProfileImageFieldSteps'
import { useProfileImageField } from './useProfileImageField'

export type { ProfileImageKind } from './ProfileImageField.types'

export const ProfileImageField = (props: ProfileImageFieldProps) => {
  const { isActive, disabled, kind, name, onActivate, themeColor } = props
  const editor = useProfileImageField(props)

  const renderActiveContent = () => {
    if (editor.state.matches('uploadPreview')) {
      return (
        <UploadCropStep
          cropImageSize={editor.cropImageSize}
          cropOffset={editor.cropOffset}
          cropZoom={editor.cropZoom}
          disabled={disabled}
          error={editor.state.context.error}
          isCropping={editor.isCropping}
          isUploading={editor.isUploading}
          kind={kind}
          onBack={() => editor.send({ type: 'BACK' })}
          onConfirm={editor.handleConfirmCrop}
          onCropImageLoad={editor.handleCropImageLoad}
          onCropOffsetChange={editor.handleCropOffsetChange}
          onCropZoomChange={editor.handleCropZoomChange}
          uploadFile={editor.uploadFile}
          uploadPreviewUrl={editor.uploadPreviewUrl}
        />
      )
    }

    if (editor.state.matches({ manualInput: 'entering' })) {
      return (
        <ManualInputStep
          disabled={disabled}
          error={editor.state.context.error}
          manualUrl={editor.state.context.manualUrl}
          onBack={() => editor.send({ type: 'BACK' })}
          onManualUrlChange={(url) =>
            editor.send({ type: 'UPDATE_MANUAL_URL', url })
          }
          onPreviewManualUrl={() => editor.send({ type: 'PREVIEW_MANUAL_URL' })}
        />
      )
    }

    if (editor.state.matches({ manualInput: 'previewing' })) {
      return (
        <ManualPreviewStep
          disabled={disabled}
          error={editor.state.context.error}
          kind={kind}
          manualUrl={editor.state.context.manualUrl}
          onBack={() => editor.send({ type: 'BACK' })}
          onImageError={editor.handleManualPreviewError}
          onUseImage={() => editor.send({ type: 'CONFIRM_MANUAL_URL' })}
        />
      )
    }

    if (editor.state.matches({ nftSelection: 'browsing' })) {
      return (
        <NftSelectionStep
          disabled={disabled}
          error={editor.nftErrorMessage ?? editor.state.context.error}
          isLoading={editor.isLoadingNfts}
          nftOwnerAddress={editor.nftOwnerAddress}
          nfts={editor.state.context.filteredNfts}
          onBack={() => editor.send({ type: 'BACK' })}
          onSearchChange={(query) =>
            editor.send({ type: 'UPDATE_NFT_SEARCH', query })
          }
          onSelectNft={(nft) => editor.send({ type: 'SELECT_NFT', nft })}
          searchQuery={editor.state.context.nftSearchQuery}
        />
      )
    }

    if (editor.state.matches({ nftSelection: 'confirming' })) {
      return (
        <NftConfirmationStep
          disabled={disabled}
          nft={editor.state.context.selectedNft}
          onBack={() => editor.send({ type: 'BACK' })}
          onUseNft={() => editor.send({ type: 'CONFIRM_NFT' })}
        />
      )
    }

    if (editor.state.matches('removeConfirmation')) {
      return (
        <RemoveConfirmationStep
          disabled={disabled}
          displayImage={editor.displayImage}
          kind={kind}
          name={name}
          onBack={() => editor.send({ type: 'BACK' })}
          onConfirm={() => editor.send({ type: 'CONFIRM_REMOVAL' })}
          themeColor={themeColor}
        />
      )
    }

    return (
      <ActiveImageOptions
        disabled={disabled}
        displayImage={editor.displayImage}
        error={editor.state.context.error}
        hasImage={editor.hasImage}
        kind={kind}
        name={name}
        onCancel={editor.handleCancel}
        onDragOver={editor.handleDragOver}
        onDrop={editor.handleDrop}
        onManual={editor.handleManualClick}
        onNft={editor.handleNftClick}
        onRemove={editor.handleRemoveClick}
        onUpload={editor.handleUploadClick}
        themeColor={themeColor}
      />
    )
  }

  return (
    <>
      {isActive ? (
        renderActiveContent()
      ) : (
        <DefaultImageField
          disabled={disabled}
          displayImage={editor.displayImage}
          hasImage={editor.hasImage}
          kind={kind}
          name={name}
          onActivate={onActivate}
          onDragOver={editor.handleDragOver}
          onDrop={editor.handleDrop}
          themeColor={themeColor}
        />
      )}
      <input
        accept="image/*"
        className="hidden"
        onChange={editor.handleFileChange}
        ref={editor.fileInputRef}
        type="file"
      />
    </>
  )
}
