import { OrderDirection } from '@ens-apps/indexer'
import type { FavoriteEntry as ApiFavoriteEntry } from './getFavorites'

export type FavoriteEntry = {
  readonly label: string
  readonly addedAt: number
}

export const toLocalEntry = (entry: ApiFavoriteEntry): FavoriteEntry => ({
  label: entry.name,
  addedAt: new Date(entry.created_at).getTime(),
})

export const filterFavoritesBySearch = (
  favorites: readonly FavoriteEntry[],
  searchQuery?: string,
): readonly FavoriteEntry[] => {
  if (!searchQuery) return favorites

  const lowerQuery = searchQuery.toLowerCase()
  return favorites.filter((fav) => fav.label.toLowerCase().includes(lowerQuery))
}

export const sortFavorites = (
  favorites: readonly FavoriteEntry[],
  sortField: 'name' | 'addedAt',
  sortDirection: OrderDirection,
): readonly FavoriteEntry[] => {
  return [...favorites].sort((a, b) => {
    if (sortField === 'name') {
      const comparison = a.label.localeCompare(b.label)
      return sortDirection === OrderDirection.Asc ? comparison : -comparison
    }
    const comparison = a.addedAt - b.addedAt
    return sortDirection === OrderDirection.Asc ? comparison : -comparison
  })
}

export type PaginatedFavorites = {
  readonly favorites: readonly FavoriteEntry[]
  readonly totalCount: number
  readonly totalPages: number
  readonly hasNextPage: boolean
  readonly hasPrevPage: boolean
  readonly startIndex: number
  readonly endIndex: number
}

export const paginateFavorites = (
  favorites: readonly FavoriteEntry[],
  page: number,
  pageSize: number,
): PaginatedFavorites => {
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedFavorites = favorites.slice(startIndex, endIndex)
  const totalPages = Math.ceil(favorites.length / pageSize)

  return {
    favorites: paginatedFavorites,
    totalCount: favorites.length,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
    startIndex: startIndex + 1,
    endIndex: Math.min(endIndex, favorites.length),
  }
}
