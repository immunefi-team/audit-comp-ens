import { Trans } from '@lingui/react/macro'
import { ArrowUpRight } from 'lucide-react'
import { CopyableButton } from '@/components/atoms/CopyableButton'
import { IconRenderer } from '@/features/profile/components/IconRenderer'
import type { ProfileRecords } from '@/features/profile/types'
import { cn } from '@/lib/utils'
import {
  ProfileCard,
  profileCardCopyIconClassName,
  profileCardTrailingIconStrokeWidth,
} from './ProfileCard'
import {
  getPrimaryContactItems,
  type ProfileContactItem,
} from './ProfileView.helpers'

const contactCardSurfaceClassName =
  'rounded-xl border-[0.25px] border-ens-quartz-300 bg-white shadow-[0_2px_6px_rgba(0,0,0,0.06)] transition hover:bg-ens-quartz-50'
const contactLabelClassName =
  'w-full truncate text-ens-quartz-500 text-[11px] leading-[16.5px] tracking-[-0.121px] lg:landscape:text-xs lg:landscape:leading-4.5 lg:landscape:tracking-[-0.132px]'
const contactValueClassName =
  'w-full truncate text-ens-quartz-500 text-[13px] leading-[19.5px] tracking-[-0.143px] lg:landscape:text-sm lg:landscape:text-ens-quartz-700 lg:landscape:leading-normal lg:landscape:tracking-[-0.154px]'
const contactTrailingIconClassName =
  'absolute top-4 right-4 ml-0 size-6 shrink-0 text-ens-quartz-400 lg:landscape:top-[24.25px] lg:landscape:right-[24.25px] lg:landscape:size-7.5 lg:landscape:text-ens-quartz-700'
const contactCopyIconClassName = cn(
  profileCardCopyIconClassName,
  'absolute top-4 right-4 lg:landscape:top-[24.25px] lg:landscape:right-[24.25px]',
)
const contactCardPaddingClassName =
  'p-4 has-[>svg]:px-4 lg:landscape:p-[24.25px] lg:landscape:has-[>svg]:px-[24.25px]'

const ContactCard = ({ item }: { readonly item: ProfileContactItem }) => {
  const content = (
    <>
      <div className="flex w-full min-w-0 flex-col items-start gap-2">
        <div className="flex w-full items-center justify-between">
          <IconRenderer
            className="size-7 text-ens-quartz-900 lg:landscape:size-7.5"
            icon={item.icon}
          />
        </div>
        <p className={contactLabelClassName}>{item.label}</p>
      </div>
      <p className={contactValueClassName}>
        {item.displayPrefix}
        {item.displayValue}
      </p>
    </>
  )

  const className = `${contactCardSurfaceClassName} ${contactCardPaddingClassName} relative flex min-h-28 w-full flex-col items-start gap-2 text-left lg:landscape:min-h-33.5`

  if (item.href) {
    return (
      <a
        className={className}
        href={item.href}
        rel="noopener noreferrer"
        target="_blank"
      >
        {content}
        <ArrowUpRight
          className={contactTrailingIconClassName}
          strokeWidth={1.33}
        />
      </a>
    )
  }

  return (
    <CopyableButton
      className={`${className} h-auto items-start`}
      iconClassName={contactCopyIconClassName}
      iconStrokeWidth={profileCardTrailingIconStrokeWidth}
      value={item.displayValue}
    >
      {content}
    </CopyableButton>
  )
}

export const ProfileContactSection = ({
  records,
}: {
  readonly records: ProfileRecords
}) => {
  const contacts = getPrimaryContactItems(records)
  if (contacts.length === 0) return null

  return (
    <ProfileCard title={<Trans>Contact</Trans>}>
      <div className="grid grid-cols-2 gap-3 lg:landscape:grid-cols-3 lg:landscape:gap-6">
        {contacts.map((item) => (
          <ContactCard item={item} key={item.key} />
        ))}
      </div>
    </ProfileCard>
  )
}
