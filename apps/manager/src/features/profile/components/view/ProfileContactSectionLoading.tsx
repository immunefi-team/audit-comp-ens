import { ProfileSkeletonCardSectionLoading } from './ProfileSkeletonCardSectionLoading'

export const ProfileContactSectionLoading = ({
  shouldReduceMotion,
}: {
  readonly shouldReduceMotion: boolean
}) => (
  <ProfileSkeletonCardSectionLoading
    index={1}
    shouldReduceMotion={shouldReduceMotion}
    titleWidth="w-17"
  />
)
