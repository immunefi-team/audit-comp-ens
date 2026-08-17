import { useHotkey } from '@tanstack/react-hotkeys'
import { AlertCircle, Loader2, RefreshCw, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const PendingChangesBar = ({
  updatesCount,
  changesCount,
  onSave,
  onDiscard,
  onDismissError,
  isSaving = false,
  isSyncing = false,
  isSwitchingChain = false,
  isWrongChain = false,
  isConnected = true,
  errorMessage,
  hasValidationErrors = false,
}: {
  updatesCount: number
  changesCount: number
  onSave: () => void
  onDiscard: () => void
  onDismissError?: () => void
  isSaving?: boolean
  isSyncing?: boolean
  isSwitchingChain?: boolean
  isWrongChain?: boolean
  isConnected?: boolean
  errorMessage?: string
  hasValidationErrors?: boolean
}) => {
  const canSave = changesCount > 0 && !hasValidationErrors && !isSaving
  useHotkey('Mod+S', onSave, { enabled: canSave })

  const saveButtonLabel = (() => {
    if (!isConnected) return 'Connect Wallet'
    if (isSwitchingChain) return 'Switching...'
    if (isWrongChain) return 'Switch Network'
    if (isSaving) return `Saving...`
    return `Save ${changesCount} ${changesCount === 1 ? 'change' : 'changes'}`
  })()

  if (changesCount === 0 && !isSyncing && !errorMessage) return null

  // Syncing state (after transaction, waiting for indexer)
  if (isSyncing) {
    return (
      <div className="sticky bottom-6 flex justify-center px-6 pointer-events-none">
        <div className="bg-card border border-border rounded-sm shadow-lg px-4 py-2 flex items-center gap-4 pointer-events-auto">
          <RefreshCw className="size-4 animate-spin" />
          <span className="text-sm text-muted-foreground">
            Syncing changes... This may take a few seconds.
          </span>
        </div>
      </div>
    )
  }

  // Error state - show error with retry option
  if (errorMessage) {
    return (
      <div className="sticky bottom-6 flex justify-center px-6 pointer-events-none">
        <div className="bg-red-50 border border-red-200 rounded-sm shadow-lg px-4 py-2 flex items-center gap-4 pointer-events-auto">
          <AlertCircle className="size-4 text-red-600 shrink-0" />
          <span className="text-sm text-red-700">{errorMessage}</span>
          {onDismissError && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDismissError}
              className="rounded-sm shrink-0"
            >
              Dismiss
            </Button>
          )}
          <Button size="sm" onClick={onSave} className="rounded-sm shrink-0">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="sticky bottom-6 flex justify-center px-6 pointer-events-none">
      <div className="bg-card border border-border rounded-sm shadow-lg px-4 py-2 flex items-center gap-4 pointer-events-auto">
        <span className="text-sm text-muted-foreground">
          <span className="font-medium">{updatesCount} </span>
          {updatesCount === 1 ? 'update' : 'updates'}
        </span>
        {hasValidationErrors && (
          <span className="text-sm text-red-600 flex items-center gap-1">
            <AlertCircle className="size-3" />
            Fix validation errors to save
          </span>
        )}
        <Button
          variant="outline"
          onClick={onDiscard}
          className="rounded-sm"
          disabled={isSaving}
        >
          Discard
          <X className="size-4 ml-1" />
        </Button>
        <Button
          disabled={hasValidationErrors}
          onClick={onSave}
          className="rounded-sm"
        >
          {isSaving ? (
            <>
              {saveButtonLabel}
              <Loader2 className="size-4 ml-1 animate-spin" />
            </>
          ) : isSwitchingChain ? (
            <>
              {saveButtonLabel}
              <Loader2 className="size-4 ml-1 animate-spin" />
            </>
          ) : (
            <>
              {saveButtonLabel}
              <Save className="size-4 ml-1" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
