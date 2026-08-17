import { useReducedMotion } from 'motion/react'
import { ProfileActionsLoading } from './ProfileActionsLoading'
import { ProfileAddressesSectionLoading } from './ProfileAddressesSectionLoading'
import { ProfileContactSectionLoading } from './ProfileContactSectionLoading'
import {
  ProfileBannerLoading,
  ProfileHeaderLoading,
} from './ProfileHeaderLoading'

type ProfileLoadingProps = {
  readonly name?: string
}

export const ProfileLoading = ({ name }: ProfileLoadingProps) => {
  const shouldReduceMotion = useReducedMotion() ?? false

  return (
    <div className="relative -mt-13.5 min-h-screen bg-[#FCFBFB] pb-[calc(117px+env(safe-area-inset-bottom,0))] lg:landscape:-mt-20 lg:landscape:pb-28.5">
      <ProfileBannerLoading shouldReduceMotion={shouldReduceMotion} />
      <div className="relative z-10 mx-auto -mt-21 w-full max-w-97.5 space-y-0 lg:landscape:-mt-11.25 lg:landscape:max-w-226.25">
        <ProfileHeaderLoading
          name={name}
          shouldReduceMotion={shouldReduceMotion}
        />
        <div className="space-y-0">
          <ProfileContactSectionLoading
            shouldReduceMotion={shouldReduceMotion}
          />
          <ProfileAddressesSectionLoading
            shouldReduceMotion={shouldReduceMotion}
          />
        </div>
      </div>
      <ProfileActionsLoading shouldReduceMotion={shouldReduceMotion} />
    </div>
  )
}
