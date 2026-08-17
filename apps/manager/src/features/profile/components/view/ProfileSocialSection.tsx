import { Trans } from '@lingui/react/macro'
import { ArrowUpRight } from 'lucide-react'
import { CopyableButton } from '@/components/atoms/CopyableButton'
import { IconRenderer } from '@/features/profile/components/IconRenderer'
import {
  getRecordDef,
  getRecordDisplayValue,
  getRecordHref,
} from '@/features/profile/data/records'
import type { ProfileRecords, TextRecordValue } from '@/features/profile/types'
import {
  cardSurfaceClassName,
  ProfileCard,
  profileCardCopyIconClassName,
  profileCardTrailingIconStrokeWidth,
} from './ProfileCard'

const socialLabelClassName =
  'truncate text-ens-quartz-500 text-xs leading-[16.5px] lg:landscape:leading-4.5'
const socialValueClassName =
  'truncate text-ens-quartz-700 text-[12px] leading-[19.5px] lg:landscape:text-sm lg:landscape:leading-6'
const socialTrailingIconClassName =
  'size-[18px] shrink-0 text-ens-quartz-400 lg:landscape:size-7.5 lg:landscape:text-ens-quartz-700'
const socialCardPaddingClassName =
  'p-3 has-[>svg]:px-3 lg:landscape:p-[24.25px] lg:landscape:has-[>svg]:px-[24.25px]'

const SocialCard = ({ record }: { readonly record: TextRecordValue }) => {
  const recordDef = getRecordDef(record.key)
  const displayValue = getRecordDisplayValue(recordDef, record.value)
  const href = getRecordHref(recordDef, displayValue)
  const content = (
    <>
      <div className="flex size-5.25 shrink-0 items-center justify-center text-ens-quartz-900 lg:landscape:size-9 lg:landscape:rounded-[10px] lg:landscape:bg-white">
        <IconRenderer
          className="size-4 lg:landscape:size-5"
          icon={recordDef?.icon}
        />
      </div>
      <div className="min-w-0 flex-1 lg:landscape:h-10.5">
        <p className={socialLabelClassName}>{recordDef?.name ?? record.key}</p>
        <p className={socialValueClassName}>
          {recordDef?.displayPrefix}
          {displayValue}
        </p>
      </div>
    </>
  )
  const className = `${cardSurfaceClassName} ${socialCardPaddingClassName} flex min-h-17 w-full items-center gap-1 font-sans text-left lg:landscape:min-h-22.75 lg:landscape:gap-2`

  if (href) {
    return (
      <a
        className={className}
        href={href}
        rel="noopener noreferrer"
        target="_blank"
      >
        {content}
        <ArrowUpRight
          className={socialTrailingIconClassName}
          strokeWidth={1.33}
        />
      </a>
    )
  }

  return (
    <CopyableButton
      className={`${className} h-auto justify-start`}
      iconClassName={profileCardCopyIconClassName}
      iconStrokeWidth={profileCardTrailingIconStrokeWidth}
      value={displayValue}
    >
      {content}
    </CopyableButton>
  )
}

export const ProfileSocialSection = ({
  records,
}: {
  readonly records: ProfileRecords
}) => {
  const socialRecords = records.social.filter((record) => record.value.trim())
  if (socialRecords.length === 0) return null

  return (
    <ProfileCard title={<Trans>Social</Trans>}>
      <div className="grid grid-cols-2 gap-3 lg:landscape:grid-cols-3 lg:landscape:gap-6">
        {socialRecords.map((record) => (
          <SocialCard key={`${record.key}-${record.value}`} record={record} />
        ))}
      </div>
    </ProfileCard>
  )
}
