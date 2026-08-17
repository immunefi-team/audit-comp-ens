import { Trans } from '@lingui/react/macro'
import { MSymbol } from '@/components/ui/material-symbol'
import type { ProfileRecords } from '@/features/profile/types'
import { getDisplayHost, getSafeProfileHref } from './ProfileView.helpers'

const getContactRecordValue = (records: ProfileRecords, key: string) =>
  records.contact.find((record) => record.key === key)?.value?.trim()

const formatLanguage = (language: string | undefined) =>
  language
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .join(', ')
    .toUpperCase()

const AboutMetaItem = ({
  icon,
  value,
}: {
  readonly icon: React.ReactNode
  readonly value: string | undefined
}) => {
  if (!value) return null

  return (
    <div className="flex min-w-0 items-center gap-1 text-ens-quartz-700">
      <span className="flex size-5 shrink-0 items-center justify-center text-ens-quartz-700 leading-none lg:landscape:size-6">
        {icon}
      </span>
      <span className="min-w-0 text-[12px] leading-4.5 lg:landscape:truncate lg:landscape:text-sm lg:landscape:leading-normal">
        {value}
      </span>
    </div>
  )
}

export const ProfileAbout = ({
  records,
}: {
  readonly records: ProfileRecords
}) => {
  const websiteHref = records.base.url
    ? getSafeProfileHref(records.base.url)
    : undefined
  const fullName = records.base.name?.trim()
  const timezone = getContactRecordValue(records, 'timezone')
  const language = formatLanguage(records.base.language)
  const location = getContactRecordValue(records, 'location')?.toUpperCase()

  return (
    <section className="flex min-h-0 flex-1 rounded-none border-none bg-transparent p-0 shadow-none lg:landscape:min-h-45.5 lg:landscape:max-w-158.75 lg:landscape:rounded-xl lg:landscape:border-[0.25px] lg:landscape:border-ens-quartz-300 lg:landscape:bg-white lg:landscape:p-6 lg:landscape:shadow-[0_2px_6px_rgba(0,0,0,0.06)]">
      <div className="grid w-full gap-8 lg:landscape:grid-cols-[minmax(0,346.5px)_228px] lg:landscape:gap-3">
        <div className="min-w-0">
          <h2 className="text-base text-ens-quartz-700 leading-normal">
            <span className="block truncate">
              {fullName || <Trans>About</Trans>}
            </span>
          </h2>
          {records.base.description ? (
            <p className="mt-3 text-ens-quartz-500 text-sm leading-normal">
              {records.base.description}
            </p>
          ) : null}
          {websiteHref ? (
            <a
              className="mt-1 inline-flex max-w-full items-center gap-1 font-mono text-(--theme-color) text-sm leading-normal hover:opacity-80"
              href={websiteHref}
              rel="noopener noreferrer"
              target="_blank"
            >
              <span className="truncate">{getDisplayHost(websiteHref)}</span>
              <MSymbol
                className="ms-opsz-20 ms-wght-300 shrink-0"
                symbol="arrow_outward"
              />
            </a>
          ) : null}
        </div>
        <div className="grid min-w-0 grid-cols-3 gap-4 lg:landscape:flex lg:landscape:flex-col lg:landscape:justify-start lg:landscape:gap-1.5">
          <AboutMetaItem
            icon={
              <MSymbol
                className="ms-opsz-20 ms-wght-300 text-[20px] lg:landscape:ms-opsz-24 lg:landscape:text-[24px]"
                symbol="language"
              />
            }
            value={timezone}
          />
          <AboutMetaItem
            icon={
              <MSymbol
                className="ms-opsz-20 ms-wght-300 text-[20px] lg:landscape:ms-opsz-24 lg:landscape:text-[24px]"
                symbol="translate"
              />
            }
            value={language}
          />
          <AboutMetaItem
            icon={
              <MSymbol
                className="ms-opsz-20 ms-wght-300 text-[20px] lg:landscape:ms-opsz-24 lg:landscape:text-[24px]"
                symbol="distance"
              />
            }
            value={location}
          />
        </div>
      </div>
    </section>
  )
}
