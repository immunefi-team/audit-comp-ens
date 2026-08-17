import {
  desktopActionContainerClassName,
  desktopActionContainerStyle,
} from './ProfileAction.styles'
import { SkeletonBlock } from './ProfileLoadingPrimitives'

const ActionIconButtonLoading = ({
  shouldReduceMotion,
}: {
  readonly shouldReduceMotion: boolean
}) => (
  <div className="flex size-13.5 shrink-0 items-center justify-center rounded bg-white shadow-[0_2px_6px_rgba(0,0,0,0.06)]">
    <SkeletonBlock
      className="size-6 rounded"
      shouldReduceMotion={shouldReduceMotion}
    />
  </div>
)

const ActionTextButtonLoading = ({
  className = '',
  shouldReduceMotion,
}: {
  readonly className?: string
  readonly shouldReduceMotion: boolean
}) => (
  <div
    className={`flex h-13.5 shrink-0 items-center justify-center rounded bg-white px-4 shadow-[0_2px_6px_rgba(0,0,0,0.06)] ${className}`}
  >
    <SkeletonBlock
      className="h-4 w-21 rounded-sm"
      shouldReduceMotion={shouldReduceMotion}
    />
  </div>
)

export const ProfileActionsLoading = ({
  shouldReduceMotion,
}: {
  readonly shouldReduceMotion: boolean
}) => (
  <>
    <div className="absolute inset-x-0 top-118.5 z-30 lg:landscape:hidden">
      <div className="mx-auto flex w-full max-w-97.5 items-center justify-between px-5">
        <ActionTextButtonLoading
          className="w-34"
          shouldReduceMotion={shouldReduceMotion}
        />
        <div className="flex items-center gap-4">
          <ActionIconButtonLoading shouldReduceMotion={shouldReduceMotion} />
          <ActionIconButtonLoading shouldReduceMotion={shouldReduceMotion} />
        </div>
      </div>
    </div>

    <div
      className={desktopActionContainerClassName}
      style={desktopActionContainerStyle}
    >
      <div className="flex items-center gap-6">
        <ActionIconButtonLoading shouldReduceMotion={shouldReduceMotion} />
        <ActionIconButtonLoading shouldReduceMotion={shouldReduceMotion} />
      </div>
      <ActionTextButtonLoading
        className="w-33"
        shouldReduceMotion={shouldReduceMotion}
      />
    </div>
  </>
)
