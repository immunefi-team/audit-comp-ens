import { Trans } from '@lingui/react/macro'
import { useFeatureFlagEnabled } from '@posthog/react'
import { useNavigate } from '@tanstack/react-router'
import { POSTHOG_FEATURE_FLAGS } from '@/lib/posthog/feature-flags'
import { cn } from '@/lib/utils'

export const UpgradeNamesButton = ({
  className,
  ...props
}: Omit<React.ComponentProps<'button'>, 'onClick'>) => {
  const navigate = useNavigate()
  const migrationEnabled = useFeatureFlagEnabled(
    POSTHOG_FEATURE_FLAGS.MIGRATION,
    false,
  )

  return (
    <button
      {...props}
      className={cn(
        'relative w-full overflow-hidden rounded-sm bg-ens-garnet-900 px-4 py-2.5 font-semi-mono text-ens-garnet-50 text-sm uppercase tracking-[0.24px] shadow-[inset_0px_-3px_0px_0px_rgba(0,0,0,0.35)]',
        className,
      )}
      disabled={!migrationEnabled || props.disabled}
      onClick={() => {
        if (migrationEnabled) navigate({ to: '/migration' })
      }}
      type="button"
    >
      <Trans>Upgrade Names</Trans>
    </button>
  )
}
