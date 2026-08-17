import { tw } from '@/utils/tailwind'
import {
  ProfileSectionLoading,
  SkeletonBlock,
} from './ProfileLoadingPrimitives'

const LinkPreviewLoading = ({
  shouldReduceMotion,
  valueWidth,
}: {
  readonly shouldReduceMotion: boolean
  readonly valueWidth: string
}) => (
  <div className="flex h-51.25 min-w-0 flex-col overflow-hidden rounded-[14px] border-[0.692px] border-[rgba(199,198,196,0.25)] bg-white shadow-[0_2px_6px_rgba(0,0,0,0.06)] lg:landscape:rounded-xl lg:landscape:border-[#C7C6C4] lg:landscape:border-[0.25px]">
    <div className="flex h-30 shrink-0 items-center justify-center bg-ens-quartz-100">
      <SkeletonBlock
        className="size-14 rounded-xl bg-ens-quartz-200 shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
        shouldReduceMotion={shouldReduceMotion}
      />
    </div>
    <div className="min-w-0 px-6 py-5">
      <SkeletonBlock
        className={tw('h-5', valueWidth)}
        shouldReduceMotion={shouldReduceMotion}
      />
      <div className="mt-1 flex min-w-0 items-center gap-1">
        <SkeletonBlock
          className="h-5 w-24"
          shouldReduceMotion={shouldReduceMotion}
        />
        <SkeletonBlock
          className="size-4 shrink-0 rounded"
          shouldReduceMotion={shouldReduceMotion}
        />
      </div>
    </div>
  </div>
)

export const ProfileLinksSectionLoading = ({
  shouldReduceMotion,
}: {
  readonly shouldReduceMotion: boolean
}) => (
  <ProfileSectionLoading
    index={4}
    shouldReduceMotion={shouldReduceMotion}
    titleWidth="w-13"
  >
    <div className="grid gap-4 lg:landscape:grid-cols-3 lg:landscape:gap-6">
      {['w-32', 'w-28', 'w-36'].map((width) => (
        <LinkPreviewLoading
          key={width}
          shouldReduceMotion={shouldReduceMotion}
          valueWidth={width}
        />
      ))}
    </div>
  </ProfileSectionLoading>
)
