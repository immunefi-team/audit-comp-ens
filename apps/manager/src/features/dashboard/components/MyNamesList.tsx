import { Trans } from '@lingui/react/macro'
import { useQueries } from '@tanstack/react-query'
import { Mountain } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useMemo, useState } from 'react'
import { match, P } from 'ts-pattern'
import {
  buildMergedNamesList,
  type MergedItem,
  mergedRowMetadata,
  type SortDir,
  type SortField,
} from '@/features/dashboard/mergedNames'
import { isRenewableV2EthName } from '@/features/grace/utils/gracePeriod'
import {
  type ProfileRecordsResult,
  profileRecordsQuery,
} from '@/features/profile/service/profileRecords'
import { useV1Renewable } from '@/features/renew/data/queries/v1Renewable.query'
import { tw } from '@/utils/tailwind'
import { useDashboardV1Names } from '../useDashboardV1Names'
import { useOwnedDomains } from '../useOwnedDomains'
import { DashboardPagination } from './DashboardPagination'
import type { NameRole } from './DashboardPills'
import { NameRow, type NameRowCta, type NameStatus } from './NameRow'
import { getNameRowProfilePreview } from './nameRowProfileRecords'

const PAGE_SIZE = 5
const OWNER_NAME_ROLES = ['owner'] as const satisfies readonly NameRole[]

export type Sort = `${SortField}-${SortDir}`

interface MyNamesListProps {
  readonly migrationEnabled?: boolean
  readonly primaryLabel?: string | null
  readonly searchQuery?: string
  readonly sort: Sort
  readonly favoriteLabels: ReadonlySet<string>
  readonly onToggleFavorite: (label: string) => void
  readonly isAuthenticated: boolean
  readonly selectedLabels?: ReadonlySet<string>
  readonly onToggleSelect?: (label: string) => void
}

const EMPTY_SELECTION: ReadonlySet<string> = new Set()
const noopToggleSelect = () => {}

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

type MergedNameRowMetadata = ReturnType<typeof mergedRowMetadata>

type NameRowActionState = {
  readonly cta: NameRowCta | null
  readonly status: NameStatus | null
}

const AnimatedNameRow = ({
  metadata,
  item,
  name,
  index,
  profileRecords,
  isProfileRecordsLoading,
  shouldReduceMotion,
  favoriteLabels,
  onToggleFavorite,
  isAuthenticated,
  selectedLabels,
  onToggleSelect,
  isV1Renewable,
}: {
  readonly metadata: MergedNameRowMetadata
  readonly item: MergedItem
  readonly name: string
  readonly index: number
  readonly profileRecords?: ProfileRecordsResult | null
  readonly isProfileRecordsLoading: boolean
  readonly shouldReduceMotion: boolean | null
  readonly favoriteLabels: ReadonlySet<string>
  readonly onToggleFavorite: (label: string) => void
  readonly isAuthenticated: boolean
  readonly selectedLabels: ReadonlySet<string>
  readonly onToggleSelect: (label: string) => void
  readonly isV1Renewable: boolean
}) => {
  const {
    label,
    daysUntilExpiry,
    expiringSoon,
    formattedExpiryDate,
    isV1,
    isPrimary,
    isInGrace,
    expiryCta,
    isMigrationEligible,
  } = metadata
  const profilePreview = getNameRowProfilePreview({
    label,
    name,
    records: profileRecords,
    isLoading: isProfileRecordsLoading,
  })
  const nameRoles: readonly NameRole[] =
    item.kind === 'v1'
      ? (item.classified.nameRoles ?? OWNER_NAME_ROLES)
      : (item.domain.nameRoles ?? OWNER_NAME_ROLES)
  const { cta, status } = match({ isV1, isMigrationEligible })
    .returnType<NameRowActionState>()
    .with({ isV1: false }, () => ({
      cta: expiryCta,
      status: null,
    }))
    .with({ isV1: true, isMigrationEligible: true }, () => ({
      cta: null,
      status: 'eligibleUpgrade',
    }))
    .with({ isV1: true, isMigrationEligible: false }, () => ({
      cta: 'manageExplorer',
      status: 'ensv1Only',
    }))
    .exhaustive()

  // V1 rows use the authoritative renewer read; V2 rows use their grace window.
  // Only V2 names can expose the bulk-selection checkbox.
  const isRenewable = isV1
    ? isV1Renewable
    : isRenewableV2EthName(label, metadata.expiryDate)

  return (
    <motion.div
      className="border-ens-quartz-250 border-b-[0.5px] py-8 first:pt-0 last:border-none md:first:pt-8"
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
      <NameRow
        avatarPending={profilePreview.isAvatarPending}
        avatarUrl={profilePreview.avatarUrl}
        canRenew={isRenewable}
        cta={cta}
        expiringInDays={!isInGrace && expiringSoon ? daysUntilExpiry : null}
        expiryLabel={formattedExpiryDate}
        isAuthenticated={isAuthenticated}
        isFavorite={favoriteLabels.has(label.toLowerCase())}
        isInGrace={isInGrace}
        isSelected={selectedLabels.has(label.toLowerCase())}
        label={label}
        nameRoles={nameRoles}
        nameVariant={isPrimary ? 'primary' : 'secondary'}
        onToggleFavorite={() => onToggleFavorite(label)}
        onToggleSelect={() => onToggleSelect(label)}
        renewalProtocol={isV1 ? 'v1' : 'v2'}
        selectable={!isV1 && isRenewable}
        showFavoriteButton
        status={status}
        themeColor={profilePreview.themeColor}
        verified={isPrimary}
      />
    </motion.div>
  )
}

export const MyNamesList = ({
  migrationEnabled = false,
  primaryLabel,
  searchQuery = '',
  sort,
  favoriteLabels,
  onToggleFavorite,
  isAuthenticated,
  selectedLabels = EMPTY_SELECTION,
  onToggleSelect = noopToggleSelect,
}: MyNamesListProps) => {
  const shouldReduceMotion = useReducedMotion()
  const [page, setPage] = useState(1)
  const { field: sortField, dir: sortDir } = parseSort(sort)

  const filterKey = `${searchQuery}:${sort}`
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey)
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey)
    setPage(1)
  }

  const {
    v1Names,
    isPending: isV1Pending,
    isError: isV1Error,
  } = useDashboardV1Names({
    migrationEnabled,
  })

  const {
    v2Names,
    isPending: isV2Pending,
    isError: isV2Error,
  } = useOwnedDomains()

  const mergedSortedFiltered = useMemo(
    () =>
      buildMergedNamesList({
        v2Names,
        v1Classified: v1Names,
        searchQuery,
        sortField,
        sortDir,
      }),
    [v2Names, v1Names, searchQuery, sortField, sortDir],
  )

  const total = mergedSortedFiltered.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageItems = mergedSortedFiltered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, total)

  const isPending = isV2Pending || isV1Pending
  const hasNames = v2Names.length > 0 || v1Names.length > 0
  const hasError = isV2Error || isV1Error
  const hasPartialError = hasError && hasNames
  const pageRows = pageItems.map((item) => ({
    item,
    metadata: mergedRowMetadata(item, primaryLabel),
    name:
      item.kind === 'v2'
        ? (item.domain.normalizedName ?? item.sortName)
        : item.sortName,
  }))
  const pageProfileRecords = useQueries({
    queries: pageRows.map(({ item, metadata, name }) => ({
      ...profileRecordsQuery(name),
      enabled: item.kind === 'v2' && !metadata.isInGrace,
    })),
    combine: (results) =>
      results.map((result) => ({
        records: result.data,
        isLoading: result.isLoading,
      })),
  })
  const { isRenewable: isV1Renewable } = useV1Renewable(
    pageRows.filter(({ item }) => item.kind === 'v1').map(({ name }) => name),
  )

  if (hasError && !hasNames) {
    return (
      <div className="py-8 text-center font-sans text-red-500 text-sm">
        <Trans>Error loading names</Trans>
      </div>
    )
  }

  return (
    <div className="w-full">
      {hasPartialError ? (
        <div
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 font-sans text-red-600 text-sm"
          role="alert"
        >
          <Trans>Some names could not be loaded</Trans>
        </div>
      ) : null}

      <div className={tw`flex w-full flex-col`}>
        {match({ isPending, pageItems })
          .with({ isPending: true }, () => (
            <>
              <div className="border-ens-quartz-250 border-b-[0.41px] py-6">
                <NameRowSkeleton />
              </div>
              <div className="border-ens-quartz-250 border-b-[0.41px] py-6">
                <NameRowSkeleton />
              </div>
              <div className="py-6">
                <NameRowSkeleton />
              </div>
            </>
          ))
          .with({ pageItems: P.when((n) => n.length === 0) }, () => (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Mountain
                className="size-12 text-ens-gray-three"
                strokeWidth={1}
              />
              <span className="font-sans text-muted-foreground text-sm">
                <Trans>No names to display</Trans>
              </span>
            </div>
          ))
          .otherwise(() =>
            pageRows.map((row, index) => {
              const profileRecordState = pageProfileRecords[index]

              return (
                <AnimatedNameRow
                  favoriteLabels={favoriteLabels}
                  index={index}
                  isAuthenticated={isAuthenticated}
                  isProfileRecordsLoading={
                    profileRecordState?.isLoading ?? false
                  }
                  isV1Renewable={
                    row.item.kind === 'v1' && isV1Renewable(row.name)
                  }
                  item={row.item}
                  key={row.item.key}
                  metadata={row.metadata}
                  name={row.name}
                  onToggleFavorite={onToggleFavorite}
                  onToggleSelect={onToggleSelect}
                  profileRecords={profileRecordState?.records}
                  selectedLabels={selectedLabels}
                  shouldReduceMotion={shouldReduceMotion}
                />
              )
            }),
          )}
      </div>

      {total > 0 && (
        <DashboardPagination
          currentPage={currentPage}
          disabled={isPending}
          onPageChange={setPage}
          rangeEnd={rangeEnd}
          rangeStart={rangeStart}
          total={total}
          totalPages={totalPages}
        />
      )}
    </div>
  )
}
