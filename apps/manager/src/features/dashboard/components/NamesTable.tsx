import { Trans, useLingui } from '@lingui/react/macro'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useAtom } from '@xstate/store-react'
import { Search } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useMemo, useState } from 'react'
import { match } from 'ts-pattern'
import { Input } from '@/components/ui/input'
import { MSymbol } from '@/components/ui/material-symbol'
import { BulkRenewDialog, type BulkRenewName } from '@/features/bulk-renew'
import { isRenewableV2Domain } from '@/features/renew/utils/renewableName'
import { isBackendAuthed } from '@/utils/backend-client'
import {
  buildMergedNamesList,
  getMergedNamesCount,
  type SortDir,
  type SortField,
} from '../mergedNames'
import { addFavoriteMutationOptions } from '../service/mutations/addFavorite'
import { removeFavoriteMutationOptions } from '../service/mutations/removeFavorite'
import { favoritesQueryOptions } from '../service/queries/getFavorites'
import { useDashboardV1Names } from '../useDashboardV1Names'
import { useOwnedDomains } from '../useOwnedDomains'
import { resolveDomainLabel } from '../utils'
import {
  FavoritesList,
  type FavoritesSort,
  type FavoritesSortField,
} from './FavoritesList'
import { type FilterChipDef, FilterChips } from './FilterChips'
import { MyNamesList, type Sort } from './MyNamesList'
import { SelectionCheckbox } from './SelectionCheckbox'
import { SortMenu, type SortOption } from './SortMenu'

type FilterKey = 'owned' | 'favorites'

interface NamesTableProps {
  readonly primaryLabel?: string | null
  readonly migrationEnabled?: boolean
}

type DirectionalSort<Field extends string> = `${Field}-${SortDir}`

const parseDirectionalSort = <Field extends string>(
  sort: DirectionalSort<Field>,
): { field: Field; dir: SortDir } => {
  const [field, dir] = sort.split('-') as [Field, SortDir]
  return { field, dir }
}

const toDirectionalSort = <Field extends string>(
  field: Field,
  dir: SortDir,
): DirectionalSort<Field> => `${field}-${dir}` as DirectionalSort<Field>

const reverseSortDir = (dir: SortDir): SortDir =>
  dir === 'asc' ? 'desc' : 'asc'

type SelectableDomain = {
  readonly id: string
  readonly name?: string | null
  readonly normalizedName?: string | null
  readonly expiryDate?: number | null
}

// Single source of truth for bulk selection, shared by the select-all set and
// the selected-names lookup so they can't drift apart.

/** The canonical key a selection is stored under. */
const selectionKey = (domain: SelectableDomain): string =>
  resolveDomainLabel(domain).toLowerCase()

/** A domain is selectable when it's a renewable v2 `.eth` 2LD (within grace). */
const isSelectableDomain = (domain: SelectableDomain): boolean =>
  isRenewableV2Domain(
    domain.normalizedName ?? domain.name ?? '',
    domain.expiryDate,
  )

/** Map a selectable domain to its bulk-renew payload, or `null` if ineligible. */
const toBulkRenewName = (domain: SelectableDomain): BulkRenewName | null => {
  if (!isSelectableDomain(domain)) return null
  const displayName = resolveDomainLabel(domain)
  // Use the canonical normalized name for the on-chain label — the display name
  // may be unnormalized (e.g. mixed case) and would hash to the wrong label.
  const name = domain.normalizedName ?? displayName
  return {
    displayName,
    label: name.replace(/\.eth$/i, ''),
    name,
    currentExpiry: BigInt(domain.expiryDate as number),
  }
}

export const NamesTable = ({
  migrationEnabled = false,
  primaryLabel,
}: NamesTableProps) => {
  const { t } = useLingui()
  const [filter, setFilter] = useState<FilterKey>('owned')
  const [searchQuery, setSearchQuery] = useState('')
  const [ownedSort, setOwnedSort] = useState<Sort>('name-asc')
  const [favoritesSort, setFavoritesSort] = useState<FavoritesSort>('name-asc')
  const ownedSortState = parseDirectionalSort<SortField>(ownedSort)
  const favoritesSortState =
    parseDirectionalSort<FavoritesSortField>(favoritesSort)
  const shouldReduceMotion = useReducedMotion()
  const isAuthed = useAtom(isBackendAuthed)
  const activeFilter = !isAuthed && filter === 'favorites' ? 'owned' : filter

  const { v2Names } = useOwnedDomains()
  const { data: favorites = [] } = useQuery({
    ...favoritesQueryOptions,
    enabled: isAuthed,
  })

  const { v1Names, isError: isV1Error } = useDashboardV1Names({
    migrationEnabled,
  })

  const favoritesCount = favorites.length
  const ownedCount = isV1Error
    ? undefined
    : getMergedNamesCount({ v2Names, v1Classified: v1Names })

  const favoriteLabels = useMemo(
    () => new Set(favorites.map((entry) => entry.name.toLowerCase())),
    [favorites],
  )

  const [selectedLabels, setSelectedLabels] = useState<ReadonlySet<string>>(
    new Set(),
  )

  // Only renewable v2 2LD .eth names are selectable — v1 names and subnames are
  // ignored for selection/renewal (subnames have no renewal price).
  const allOwnedLabels = useMemo(
    () =>
      buildMergedNamesList({
        v2Names,
        v1Classified: [],
        searchQuery,
        sortField: ownedSortState.field,
        sortDir: ownedSortState.dir,
      }).flatMap((item) =>
        item.kind === 'v2' && isSelectableDomain(item.domain)
          ? [selectionKey(item.domain)]
          : [],
      ),
    [v2Names, searchQuery, ownedSortState.field, ownedSortState.dir],
  )

  const [isRenewOpen, setIsRenewOpen] = useState(false)

  const selectedCount = selectedLabels.size
  const allSelected =
    allOwnedLabels.length > 0 &&
    allOwnedLabels.every((label) => selectedLabels.has(label))
  const someSelected = selectedCount > 0

  const selectedNames = useMemo<BulkRenewName[]>(
    () =>
      v2Names
        .filter((domain) => selectedLabels.has(selectionKey(domain)))
        .map(toBulkRenewName)
        .filter((name): name is BulkRenewName => name !== null),
    [v2Names, selectedLabels],
  )

  const onToggleSelect = (label: string) => {
    const key = label.toLowerCase()
    setSelectedLabels((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  // Toggle only the currently-visible names, preserving any selections made
  // under a different search/filter.
  const onToggleSelectAll = () => {
    setSelectedLabels((prev) => {
      const allIn =
        allOwnedLabels.length > 0 &&
        allOwnedLabels.every((label) => prev.has(label))
      const next = new Set(prev)
      for (const label of allOwnedLabels) {
        if (allIn) next.delete(label)
        else next.add(label)
      }
      return next
    })
  }

  const addMutation = useMutation(addFavoriteMutationOptions)
  const removeMutation = useMutation(removeFavoriteMutationOptions)
  const onToggleFavorite = (label: string) => {
    if (favoriteLabels.has(label.toLowerCase())) {
      removeMutation.mutate({ name: label })
    } else {
      addMutation.mutate({ name: label })
    }
  }

  const ownedSortOptions: SortOption<SortField>[] = [
    { value: 'name', label: t`Name` },
    { value: 'created', label: t`Created` },
    { value: 'expiry', label: t`Expiry Date` },
  ]

  const favoritesSortOptions: SortOption<FavoritesSortField>[] = [
    { value: 'name', label: t`Name` },
    { value: 'addedAt', label: t`Created` },
  ]

  const chips: FilterChipDef<FilterKey>[] = [
    {
      value: 'owned',
      label: t`Owned`,
      count: ownedCount,
      activeClassName:
        'bg-ens-lapis-100 text-ens-lapis-500 shadow-[inset_0px_0px_1px_0px_rgba(0,130,187,0.25)]',
      activeCountClassName: 'bg-ens-lapis-tint text-ens-lapis-900',
    },
    {
      value: 'favorites',
      label: t`Favorites`,
      count: favoritesCount,
      disabled: !isAuthed,
      activeClassName:
        'bg-ens-garnet-100 text-ens-garnet-500 shadow-[inset_0px_0px_1px_0px_rgba(255,110,158,0.25)]',
      activeCountClassName: 'bg-[#fffafc] text-ens-garnet-900',
    },
  ]

  return (
    <div className="w-full">
      <div className="mb-5 flex w-full flex-col items-start gap-5 md:mb-4">
        <div className="flex w-full flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <h2 className="font-sans text-[#232222] text-[16px] leading-[0.96] tracking-[0.16px] md:text-[28px] md:tracking-[0.28px]">
            <Trans>My Names</Trans>
          </h2>
          <div className="w-full md:w-88">
            <Input
              className="h-10 rounded-full border-none bg-ens-white pl-10 text-base text-foreground tracking-[-0.32px] shadow-none placeholder:text-ens-quartz-350 focus-visible:ring-0"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t`Search my names`}
              startIcon={
                <Search className="-ml-1 size-4.5 text-ens-quartz-350" />
              }
              value={searchQuery}
            />
          </div>
        </div>

        <div className="flex flex-col items-start gap-5 md:flex-row md:items-center">
          {activeFilter === 'owned' ? (
            <SortMenu
              direction={ownedSortState.dir}
              onChange={(field) =>
                setOwnedSort(toDirectionalSort(field, ownedSortState.dir))
              }
              onToggleDirection={() =>
                setOwnedSort((current) => {
                  const { field, dir } =
                    parseDirectionalSort<SortField>(current)
                  return toDirectionalSort(field, reverseSortDir(dir))
                })
              }
              options={ownedSortOptions}
              value={ownedSortState.field}
            />
          ) : (
            <SortMenu
              direction={favoritesSortState.dir}
              onChange={(field) =>
                setFavoritesSort(
                  toDirectionalSort(field, favoritesSortState.dir),
                )
              }
              onToggleDirection={() =>
                setFavoritesSort((current) => {
                  const { field, dir } =
                    parseDirectionalSort<FavoritesSortField>(current)
                  return toDirectionalSort(field, reverseSortDir(dir))
                })
              }
              options={favoritesSortOptions}
              value={favoritesSortState.field}
            />
          )}
          <FilterChips
            chips={chips}
            onChange={(next) => {
              setFilter(next)
              setSearchQuery('')
            }}
            value={activeFilter}
          />
        </div>

        {activeFilter === 'owned' && allOwnedLabels.length > 0 && (
          <div className="flex w-full items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <SelectionCheckbox
                ariaLabel={
                  allSelected ? t`Deselect all names` : t`Select all names`
                }
                checked={allSelected}
                indeterminate={someSelected && !allSelected}
                onToggle={onToggleSelectAll}
              />
              <span className="font-sans text-[#232222] text-sm tracking-[0.28px]">
                {selectedCount > 0 ? (
                  <Trans>{selectedCount} selected</Trans>
                ) : (
                  <Trans>Select all</Trans>
                )}
              </span>
            </div>
            {someSelected && (
              <button
                className="flex h-8.5 items-center gap-1.5 rounded-sm border border-ens-lapis-500 px-2 py-1.5 font-normal font-semi-mono text-base text-ens-lapis-500 uppercase leading-none tracking-[-0.16px] hover:opacity-80"
                onClick={() => setIsRenewOpen(true)}
                type="button"
              >
                <Trans>Renew</Trans>
                <MSymbol
                  aria-hidden="true"
                  className="text-base leading-none"
                  symbol="double_arrow"
                />
              </button>
            )}
          </div>
        )}
      </div>

      <AnimatePresence mode="popLayout">
        {match(activeFilter)
          .with('owned', () => (
            <motion.div
              key="owned"
              {...(shouldReduceMotion
                ? {}
                : {
                    initial: { opacity: 0 },
                    animate: { opacity: 1 },
                    exit: { opacity: 0 },
                    transition: {
                      duration: 0.15,
                      ease: [0.25, 0.46, 0.45, 0.94] as const,
                    },
                  })}
            >
              <MyNamesList
                favoriteLabels={favoriteLabels}
                isAuthenticated={isAuthed}
                migrationEnabled={migrationEnabled}
                onToggleFavorite={onToggleFavorite}
                onToggleSelect={onToggleSelect}
                primaryLabel={primaryLabel}
                searchQuery={searchQuery}
                selectedLabels={selectedLabels}
                sort={ownedSort}
              />
            </motion.div>
          ))
          .with('favorites', () => (
            <motion.div
              key="favorites"
              {...(shouldReduceMotion
                ? {}
                : {
                    initial: { opacity: 0 },
                    animate: { opacity: 1 },
                    exit: { opacity: 0 },
                    transition: {
                      duration: 0.15,
                      ease: [0.25, 0.46, 0.45, 0.94] as const,
                    },
                  })}
            >
              <FavoritesList
                isAuthenticated={isAuthed}
                searchQuery={searchQuery}
                sort={favoritesSort}
              />
            </motion.div>
          ))
          .exhaustive()}
      </AnimatePresence>

      <BulkRenewDialog
        names={selectedNames}
        onOpenChange={setIsRenewOpen}
        onRenewed={() => setSelectedLabels(new Set())}
        open={isRenewOpen}
      />
    </div>
  )
}
