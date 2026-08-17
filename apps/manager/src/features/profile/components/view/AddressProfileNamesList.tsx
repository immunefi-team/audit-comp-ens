import { Trans, useLingui } from '@lingui/react/macro'
import { useMutation, useQueries, useQuery } from '@tanstack/react-query'
import { useAtom } from '@xstate/store-react'
import { CheckSquare, Mountain, Search, Square } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useMemo, useState } from 'react'
import { match } from 'ts-pattern'
import { Input } from '@/components/ui/input'
import { DashboardPagination } from '@/features/dashboard/components/DashboardPagination'
import type { FilterChipDef } from '@/features/dashboard/components/FilterChips'
import { FilterChips } from '@/features/dashboard/components/FilterChips'
import {
  NameRow,
  type NameStatus,
} from '@/features/dashboard/components/NameRow'
import { getNameRowProfilePreview } from '@/features/dashboard/components/nameRowProfileRecords'
import {
  SortMenu,
  type SortOption,
} from '@/features/dashboard/components/SortMenu'
import type { SortDir, SortField } from '@/features/dashboard/mergedNames'
import { addFavoriteMutationOptions } from '@/features/dashboard/service/mutations/addFavorite'
import { removeFavoriteMutationOptions } from '@/features/dashboard/service/mutations/removeFavorite'
import { favoritesQueryOptions } from '@/features/dashboard/service/queries/getFavorites'
import {
  formatDashboardDate,
  NON_EXPIRING_DATE_LABEL,
  toDateFromSeconds,
} from '@/features/dashboard/utils'
import {
  PROFILE_NAMES_PAGE_SIZE,
  type ProfileAddressName,
} from '@/features/profile/service/profileAddressNames'
import { profileRecordsQuery } from '@/features/profile/service/profileRecords'
import { useFeatureFlag } from '@/hooks/useFeatureFlag'
import { cn } from '@/lib/utils'
import { isBackendAuthed } from '@/utils/backend-client'
import { tw } from '@/utils/tailwind'

type RoleFilter = 'owned' | 'managed'
type Sort = `${SortField}-${SortDir}`

const NameRowSkeleton = () => (
  <div className="flex flex-col gap-4">
    <div className="h-5 w-30 animate-pulse rounded-full bg-gray-200" />
    <div className="flex items-center gap-4">
      <div className="size-8.5 shrink-0 animate-pulse rounded-sm bg-gray-200" />
      <div className="h-7 w-37.5 animate-pulse rounded-xs bg-gray-200" />
    </div>
    <div className="h-4 w-45 animate-pulse rounded bg-gray-200" />
  </div>
)

const parseSort = (sort: Sort): { field: SortField; dir: SortDir } => {
  const [field, dir] = sort.split('-') as [SortField, SortDir]
  return { field, dir }
}

const toSort = (field: SortField, dir: SortDir): Sort =>
  `${field}-${dir}` as Sort

const reverseSortDir = (dir: SortDir): SortDir =>
  dir === 'asc' ? 'desc' : 'asc'

const getExpirySortValue = (expiry: number | null): number | null =>
  expiry === 0 ? null : expiry

const compareNames = (
  a: ProfileAddressName,
  b: ProfileAddressName,
  field: SortField,
  dir: SortDir,
): number => {
  const mul = dir === 'asc' ? 1 : -1
  if (field === 'name') {
    return a.label.localeCompare(b.label) * mul
  }
  const ax =
    field === 'created' ? a.createdAt : getExpirySortValue(a.expiryDate)
  const bx =
    field === 'created' ? b.createdAt : getExpirySortValue(b.expiryDate)
  if (ax === null && bx === null) return 0
  if (ax === null) return 1
  if (bx === null) return -1
  return (ax - bx) * mul
}

const formatExpiryLabel = (expiryDate: number | null): string | null => {
  if (expiryDate === 0) return NON_EXPIRING_DATE_LABEL
  const asDate = toDateFromSeconds(expiryDate)
  const formatted = formatDashboardDate(asDate)
  return formatted === '—' ? null : formatted
}

const SelectionCheckbox = ({
  checked,
  onChange,
  label,
}: {
  readonly checked: boolean
  readonly onChange: () => void
  readonly label: string
}) => (
  <label className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center text-ens-quartz-700">
    <input
      aria-label={label}
      checked={checked}
      className="sr-only"
      onChange={onChange}
      type="checkbox"
    />
    {checked ? (
      <CheckSquare className="size-6" strokeWidth={1.5} />
    ) : (
      <Square className="size-6" strokeWidth={1.5} />
    )}
  </label>
)

export const AddressProfileNamesList = ({
  addressNames,
  primaryName,
  isConnectedView,
  isPending = false,
  isError = false,
  isPlaceholderData = false,
}: {
  readonly addressNames: readonly ProfileAddressName[]
  readonly primaryName?: string
  readonly isConnectedView: boolean
  readonly isPending?: boolean
  readonly isError?: boolean
  readonly isPlaceholderData?: boolean
}) => {
  const { t } = useLingui()
  const shouldReduceMotion = useReducedMotion()
  const isAuthed = useAtom(isBackendAuthed)
  const selectionEnabled = useFeatureFlag('PROFILE_ADDRESS_NAMES_SELECTION')
  const showSelection = isConnectedView && selectionEnabled
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [sort, setSort] = useState<Sort>('created-desc')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('owned')
  const [selectedKeys, setSelectedKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const { field: sortField, dir: sortDir } = parseSort(sort)

  const allNames = addressNames

  const { data: favorites = [] } = useQuery({
    ...favoritesQueryOptions,
    enabled: isConnectedView && isAuthed,
  })
  const favoriteLabels = useMemo(
    () => new Set(favorites.map((entry) => entry.name.toLowerCase())),
    [favorites],
  )
  const addMutation = useMutation(addFavoriteMutationOptions)
  const removeMutation = useMutation(removeFavoriteMutationOptions)
  const onToggleFavorite = (label: string) => {
    if (favoriteLabels.has(label.toLowerCase())) {
      removeMutation.mutate({ name: label })
    } else {
      addMutation.mutate({ name: label })
    }
  }

  const ownedCount = useMemo(
    () => allNames.filter((name) => name.roleCategory === 'owned').length,
    [allNames],
  )
  const managedCount = useMemo(
    () => allNames.filter((name) => name.roleCategory === 'managed').length,
    [allNames],
  )

  const filteredSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return allNames
      .filter((name) => {
        if (isConnectedView && name.roleCategory !== roleFilter) return false
        if (q && !name.label.toLowerCase().includes(q)) return false
        return true
      })
      .sort((a, b) => compareNames(a, b, sortField, sortDir))
  }, [allNames, isConnectedView, roleFilter, searchQuery, sortDir, sortField])

  const filterKey = `${searchQuery}:${sort}:${roleFilter}:${isConnectedView}:${showSelection}`
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey)
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey)
    setPage(1)
    if (showSelection) setSelectedKeys(new Set())
  }

  const total = filteredSorted.length
  const totalPages = Math.max(1, Math.ceil(total / PROFILE_NAMES_PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageItems = filteredSorted.slice(
    (currentPage - 1) * PROFILE_NAMES_PAGE_SIZE,
    currentPage * PROFILE_NAMES_PAGE_SIZE,
  )
  const rangeStart =
    total === 0 ? 0 : (currentPage - 1) * PROFILE_NAMES_PAGE_SIZE + 1
  const rangeEnd = Math.min(currentPage * PROFILE_NAMES_PAGE_SIZE, total)

  const pageProfileRecords = useQueries({
    queries: pageItems.map((name) => ({
      ...profileRecordsQuery(name.label),
      enabled: name.protocol === 'v2',
    })),
    combine: (results) =>
      results.map((result) => ({
        records: result.data,
        isLoading: result.isLoading,
      })),
  })

  const pageKeys = pageItems.map((item) => item.key)
  const allPageSelected =
    showSelection &&
    pageKeys.length > 0 &&
    pageKeys.every((key) => selectedKeys.has(key))

  const toggleSelectAll = () => {
    setSelectedKeys((current) => {
      const next = new Set(current)
      if (allPageSelected) {
        for (const key of pageKeys) next.delete(key)
      } else {
        for (const key of pageKeys) next.add(key)
      }
      return next
    })
  }

  const toggleSelected = (key: string) => {
    setSelectedKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const sortOptions: SortOption<SortField>[] = [
    { value: 'name', label: t`Name` },
    { value: 'created', label: t`Created` },
    { value: 'expiry', label: t`Expiry Date` },
  ]

  const chips: FilterChipDef<RoleFilter>[] = [
    {
      value: 'owned',
      label: t`Owned`,
      count: ownedCount,
    },
    {
      value: 'managed',
      label: t`Managed`,
      count: managedCount,
    },
  ]

  const namesContent = match({
    isPending,
    isError,
    hasNames: pageItems.length > 0,
  })
    .with({ isPending: true }, () => (
      <>
        {/* border-b-[0.5px]: sub-pixel hairline divider per Figma — no design token */}
        <div className="border-ens-quartz-250 border-b-[0.5px] py-8">
          <NameRowSkeleton />
        </div>
        <div className="border-ens-quartz-250 border-b-[0.5px] py-8">
          <NameRowSkeleton />
        </div>
        <div className="py-8">
          <NameRowSkeleton />
        </div>
      </>
    ))
    .with({ isError: true }, () => (
      <div className="rounded-lg bg-ens-citrine-50 px-4 py-3 text-ens-citrine-450 text-sm">
        <Trans>Unable to load names for this address. Please try again.</Trans>
      </div>
    ))
    .with({ hasNames: false }, () => (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <Mountain className="size-12 text-ens-gray-three" strokeWidth={1} />
        <span className="font-sans text-muted-foreground text-sm">
          <Trans>No names to display</Trans>
        </span>
      </div>
    ))
    .otherwise(() =>
      pageItems.map((name, index) => {
        const isPrimary =
          !!primaryName &&
          name.label.toLowerCase() === primaryName.toLowerCase()
        const status: NameStatus | null =
          name.protocol === 'v1' ? 'ensv1Only' : null
        const profilePreview = getNameRowProfilePreview({
          label: name.label,
          name: name.label,
          records: pageProfileRecords[index]?.records,
          isLoading: pageProfileRecords[index]?.isLoading,
        })
        const expiryLabel = formatExpiryLabel(name.expiryDate)

        return (
          <motion.div
            className="border-ens-quartz-250 border-b-[0.5px] py-8 last:border-none" // sub-pixel hairline divider per Figma — no design token
            key={name.key}
            {...(shouldReduceMotion
              ? {}
              : {
                  initial: { opacity: 0, y: 6 },
                  animate: { opacity: 1, y: 0 },
                  transition: {
                    duration: 0.2,
                    ease: [0.25, 0.46, 0.45, 0.94] as const,
                    delay: index * 0.04,
                  },
                })}
          >
            <div
              className={cn(
                'flex items-start gap-2',
                showSelection && 'md:gap-3',
              )}
            >
              {showSelection ? (
                <SelectionCheckbox
                  checked={selectedKeys.has(name.key)}
                  label={t`Select ${name.label}`}
                  onChange={() => toggleSelected(name.key)}
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <NameRow
                  avatarPending={profilePreview.isAvatarPending}
                  avatarUrl={profilePreview.avatarUrl}
                  canRenew={false}
                  expiryLabel={expiryLabel}
                  isAuthenticated={isAuthed}
                  isFavorite={favoriteLabels.has(name.label.toLowerCase())}
                  label={name.label}
                  nameRoles={name.nameRoles}
                  nameVariant={isPrimary ? 'primary' : 'secondary'}
                  onToggleFavorite={() => onToggleFavorite(name.label)}
                  showFavoriteButton={isConnectedView}
                  status={status}
                  themeColor={profilePreview.themeColor}
                  verified={isPrimary}
                />
              </div>
            </div>
          </motion.div>
        )
      }),
    )

  return (
    <div
      className="w-full rounded-none border-[#dededf] border-[0.25px] bg-white px-4 py-6 shadow-none md:rounded-xl md:px-6 md:py-8" // Figma-spec hairline width and border colour — no matching design tokens
    >
      {isConnectedView ? (
        <div className="mb-5 flex w-full flex-col items-start gap-5">
          <div className="flex w-full flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <h2
              className="font-sans text-[#232222] text-[20px] leading-[0.96] tracking-[0.2px] md:text-[28px] md:tracking-[0.28px]" // Figma-spec heading colour/size/tracking — no matching design tokens
            >
              <Trans>Names</Trans>
            </h2>
            <div className="w-full md:w-88">
              <Input
                className="h-10 rounded-full border-none bg-ens-white pl-10 text-base text-foreground tracking-[-0.32px] shadow-none placeholder:text-ens-quartz-350"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t`Search names`}
                startIcon={
                  <Search className="-ml-1 size-4.5 text-ens-quartz-350" />
                }
                value={searchQuery}
              />
            </div>
          </div>

          <div className="flex flex-col items-start gap-5 md:flex-row md:items-center">
            <SortMenu
              direction={sortDir}
              onChange={(field) => setSort(toSort(field, sortDir))}
              onToggleDirection={() =>
                setSort((current) => {
                  const { field, dir } = parseSort(current)
                  return toSort(field, reverseSortDir(dir))
                })
              }
              options={sortOptions}
              value={sortField}
            />
            <FilterChips
              chips={chips}
              onChange={setRoleFilter}
              value={roleFilter}
            />
          </div>

          {showSelection ? (
            <div
              className="inline-flex h-8 items-center gap-0.5 rounded-full text-[#232222]" // Figma-spec text colour — no matching design token
            >
              <SelectionCheckbox
                checked={allPageSelected}
                label={t`Select all`}
                onChange={toggleSelectAll}
              />
              <button
                className="font-sans text-base tracking-[0.32px]"
                onClick={toggleSelectAll}
                type="button"
              >
                <Trans>Select all</Trans>
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        className={tw(
          'flex w-full flex-col',
          isPlaceholderData && 'opacity-50 transition-opacity',
        )}
      >
        {namesContent}
      </div>

      {!isPending && !isError && total > 0 ? (
        <div className="mt-6">
          <DashboardPagination
            currentPage={currentPage}
            disabled={isPending}
            onPageChange={setPage}
            rangeEnd={rangeEnd}
            rangeStart={rangeStart}
            total={total}
            totalPages={totalPages}
          />
        </div>
      ) : null}
    </div>
  )
}
