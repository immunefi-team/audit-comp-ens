import { OrderDirection } from '@ens-apps/indexer'
import { Trans } from '@lingui/react/macro'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Mountain } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useMemo, useState } from 'react'
import { match, P } from 'ts-pattern'
import { buildNameAvatarUrl } from '@/features/profile/service/profileAvatar'
import { removeFavoriteMutationOptions } from '../service/mutations/removeFavorite'
import {
  filterFavoritesBySearch,
  paginateFavorites,
  sortFavorites,
  toLocalEntry,
} from '../service/queries/favorites.helpers'
import { favoritesQueryOptions } from '../service/queries/getFavorites'
import { DashboardPagination } from './DashboardPagination'
import { NameRow } from './NameRow'

export type FavoritesSortField = 'name' | 'addedAt'
export type FavoritesSort = `${FavoritesSortField}-${'asc' | 'desc'}`

interface FavoritesListProps {
  readonly searchQuery?: string
  readonly sort: FavoritesSort
  readonly isAuthenticated: boolean
}

const PAGE_SIZE = 5

const NameRowSkeleton = () => (
  <div className="flex items-center gap-4">
    <div className="size-6.5 shrink-0 animate-pulse rounded bg-gray-200" />
    <div className="size-8.5 shrink-0 animate-pulse rounded-sm bg-gray-200" />
    <div className="h-7 w-37.5 animate-pulse rounded-xs bg-gray-200" />
  </div>
)

const parseSort = (
  sort: FavoritesSort,
): { field: FavoritesSortField; direction: OrderDirection } => {
  const [field, dir] = sort.split('-') as [FavoritesSortField, 'asc' | 'desc']
  return {
    field,
    direction: dir === 'asc' ? OrderDirection.Asc : OrderDirection.Desc,
  }
}

export const FavoritesList = ({
  searchQuery = '',
  sort,
  isAuthenticated,
}: FavoritesListProps) => {
  const shouldReduceMotion = useReducedMotion()
  const [page, setPage] = useState(1)
  const { field: sortField, direction: sortDirection } = parseSort(sort)

  const filterKey = `${searchQuery} ${sort}`
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey)
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey)
    setPage(1)
  }

  const { data: apiFavorites = [], isLoading } = useQuery({
    ...favoritesQueryOptions,
    enabled: isAuthenticated,
  })
  const favorites = apiFavorites.map(toLocalEntry)
  const favoritesCount = apiFavorites.length
  const removeMutation = useMutation(removeFavoriteMutationOptions)

  const toggleFavorite = (label: string) => {
    removeMutation.mutate({ name: label })
  }

  const sortedFiltered = useMemo(() => {
    const filtered = filterFavoritesBySearch(favorites, searchQuery)
    return sortFavorites(filtered, sortField, sortDirection)
  }, [favorites, searchQuery, sortField, sortDirection])

  const totalCount = sortedFiltered.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginatedData = paginateFavorites(
    sortedFiltered,
    currentPage,
    PAGE_SIZE,
  )
  const paginatedFavorites = paginatedData.favorites

  return (
    <div className="w-full">
      <div className="flex w-full flex-col">
        {match({ isLoading, paginatedFavorites, favoritesCount })
          .with({ isLoading: true }, () => (
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
          .with({ favoritesCount: 0 }, () => (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Mountain
                className="size-12 text-ens-gray-three"
                strokeWidth={1}
              />
              <span className="font-sans text-muted-foreground text-sm">
                <Trans>No favorites to display</Trans>
              </span>
            </div>
          ))
          .with({ paginatedFavorites: P.when((f) => f.length === 0) }, () => (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Mountain
                className="size-12 text-ens-gray-three"
                strokeWidth={1}
              />
              <span className="font-sans text-muted-foreground text-sm">
                <Trans>No favorites to display</Trans>
              </span>
            </div>
          ))
          .otherwise(({ paginatedFavorites }) =>
            paginatedFavorites.map((fav, index) => (
              <motion.div
                className="border-ens-quartz-250 border-b-[0.5px] py-8 first:pt-0 last:border-none md:first:pt-8"
                key={fav.label}
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
                  avatarUrl={buildNameAvatarUrl(fav.label)}
                  isAuthenticated
                  isFavorite
                  label={fav.label}
                  onToggleFavorite={() => toggleFavorite(fav.label)}
                  showFavoriteButton
                />
              </motion.div>
            )),
          )}
      </div>

      {totalCount > 0 && (
        <DashboardPagination
          currentPage={currentPage}
          disabled={isLoading}
          onPageChange={setPage}
          rangeEnd={paginatedData.endIndex}
          rangeStart={paginatedData.startIndex}
          total={totalCount}
          totalPages={totalPages}
        />
      )}
    </div>
  )
}
