import { Trans } from '@lingui/react/macro'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { type ChangeEvent, useRef, useState } from 'react'
import { match, P } from 'ts-pattern'
import { PatternAvatar } from '@/components/atoms/PatternAvatar'
import {
  AddressSuggestionCard,
  DomainProfileCard,
  DomainResultCard,
  domainResultStatusFromGrace,
} from '@/components/molecules/DomainResultCard'
import { SearchField } from '@/components/molecules/SearchField'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useCheckAvailability } from '@/features/landing/check-availability/useCheckAvailability'
import { useOpenFirstSearchResultHotkey } from '@/features/navigation/Header/search/useOpenFirstSearchResultHotkey'
import { buildNameAvatarUrl } from '@/features/profile/service/profileAvatar'
import {
  getProfileExpiryResultStatus,
  profileExpiryQuery,
} from '@/features/profile/service/profileExpiry'
import { profileRecordsQuery } from '@/features/profile/service/profileRecords'
import { profileRegistrationQuery } from '@/features/profile/service/profileRegistration'
import { useDebounce } from '@/hooks/useDebounce'
import { truncateToMaxBytes } from '@/utils/domain'

const dropdownAnimation = {
  initial: { opacity: 0, y: -8, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.98 },
  transition: { duration: 0.2 },
}

export type CheckAvailabilityProps = {
  onRegistrationComplete?: (name: string) => void
}

export const CheckAvailability = ({
  onRegistrationComplete: _onRegistrationComplete,
}: CheckAvailabilityProps) => {
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsContainerRef = useRef<HTMLDivElement>(null)

  const { debouncedValue } = useDebounce(inputValue, { delay: 500 })

  const {
    displayState,
    pricing,
    premiumLabel,
    isInCooldown,
    primaryName,
    selectedName,
    isLoading,
    error,
  } = useCheckAvailability({ inputValue, debouncedInput: debouncedValue })

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setInputValue(truncateToMaxBytes(event.target.value))
  }

  useOpenFirstSearchResultHotkey({
    enabled: debouncedValue === inputValue,
    resultsContainer: resultsContainerRef,
    target: inputRef,
  })

  // Determine which name to fetch profile data for
  const profileName = match(displayState)
    .with({ type: 'unavailable' }, () => selectedName)
    .with({ type: 'address' }, () => primaryName ?? null)
    .otherwise(() => null)

  const { data: profileRecords } = useQuery({
    ...profileRecordsQuery(profileName ?? ''),
    enabled: !!profileName,
  })

  const themeColor = profileRecords?.texts.find(
    (text) => text.key === 'theme',
  )?.value

  const profileAvatar = profileName
    ? buildNameAvatarUrl(profileName)
    : undefined

  const { data: profileExpiry } = useQuery({
    ...profileExpiryQuery(profileName ?? ''),
    enabled: !!profileName,
  })

  const { data: profileRegistration } = useQuery({
    ...profileRegistrationQuery(profileName ?? ''),
    enabled: !!profileName,
  })

  return (
    <div className="relative flex flex-col gap-2">
      <div className="relative z-20">
        <SearchField
          className="w-full"
          isLoading={isLoading}
          onChange={handleInputChange}
          placeholder=".eth"
          ref={inputRef}
          value={inputValue}
        />

        <div
          className="absolute top-full z-10 mt-2 w-full space-y-4 drop-shadow-lg"
          ref={resultsContainerRef}
        >
          <AnimatePresence mode="wait">
            {match({ error, displayState })
              .with({ error: P.nonNullable }, ({ error: err }) => (
                <motion.div key="error" {...dropdownAnimation}>
                  <Alert variant="destructive">
                    <AlertDescription>
                      {err instanceof Error ? (
                        err.message
                      ) : (
                        <Trans>An error occurred</Trans>
                      )}
                    </AlertDescription>
                  </Alert>
                </motion.div>
              ))
              .with(
                { displayState: { type: 'not-supported' } },
                ({ displayState: state }) => (
                  <motion.div
                    key={`result-${state.domainName}`}
                    {...dropdownAnimation}
                  >
                    <div className="flex w-full items-center gap-4 rounded-sm bg-ens-white px-5 py-5 shadow-lg">
                      <div className="size-12 shrink-0 overflow-hidden rounded-md">
                        <PatternAvatar
                          className="size-full min-h-0 min-w-0"
                          name={state.domainName}
                        />
                      </div>
                      <span className="font-medium text-ens-blue text-lg leading-tight tracking-tight">
                        {state.domainName}
                      </span>
                      <div className="ml-auto shrink-0 rounded-full bg-red-50 px-2 py-1 font-normal text-red-500 text-xs">
                        <Trans>Not supported</Trans>
                      </div>
                    </div>
                  </motion.div>
                ),
              )
              .with(
                { displayState: { type: 'address' } },
                ({ displayState: state }) => (
                  <motion.div
                    key={`result-${state.address}`}
                    {...dropdownAnimation}
                  >
                    <div className="flex flex-col gap-3">
                      <AddressSuggestionCard
                        address={state.address}
                        variant="card"
                      />
                      {primaryName && (
                        <Link params={{ name: primaryName }} to="/$name">
                          <DomainProfileCard
                            avatarUrl={profileAvatar}
                            clickable
                            domainName={primaryName}
                            expiryDate={
                              profileExpiry?.expiry == null
                                ? null
                                : new Date(Number(profileExpiry.expiry) * 1000)
                            }
                            registeredDate={
                              profileRegistration?.registrationDate == null
                                ? null
                                : new Date(
                                    profileRegistration.registrationDate * 1000,
                                  )
                            }
                            themeColor={themeColor}
                          />
                        </Link>
                      )}
                    </div>
                  </motion.div>
                ),
              )
              .with(
                { displayState: { type: 'searching' } },
                ({ displayState: state }) => (
                  <motion.div
                    key={`result-${state.domainName}`}
                    {...dropdownAnimation}
                  >
                    <DomainResultCard
                      domainName={state.domainName}
                      isLoading={true}
                      premiumLabel={premiumLabel}
                      price={pricing[1]?.price}
                      status="available"
                    />
                  </motion.div>
                ),
              )
              .with(
                { displayState: { type: 'available' } },
                ({ displayState: state }) => (
                  <motion.div
                    key={`result-${state.domainName}`}
                    {...dropdownAnimation}
                  >
                    <Link
                      params={{ name: state.domainName }}
                      to="/register/$name"
                    >
                      <DomainResultCard
                        clickable
                        domainName={state.domainName}
                        isInCooldown={isInCooldown}
                        isLoading={false}
                        premiumLabel={premiumLabel}
                        price={pricing[1]?.price}
                        status="available"
                      />
                    </Link>
                  </motion.div>
                ),
              )
              .with(
                { displayState: { type: 'unavailable' } },
                ({ displayState: state }) => (
                  <motion.div
                    key={`result-${state.domainName}`}
                    {...dropdownAnimation}
                  >
                    <Link params={{ name: state.domainName }} to="/$name">
                      <DomainResultCard
                        clickable
                        domainName={state.domainName}
                        status={domainResultStatusFromGrace(
                          getProfileExpiryResultStatus(profileExpiry).isInGrace,
                        )}
                      />
                    </Link>
                  </motion.div>
                ),
              )
              .otherwise(() => null)}
          </AnimatePresence>
        </div>
      </div>
      <p className="pl-1 font-medium font-sans text-ens-lapis-surface text-sm leading-normal tracking-wide">
        <Trans>Start typing to check if your perfect name is available</Trans>{' '}
        🕵️‍♀️
      </p>
    </div>
  )
}
