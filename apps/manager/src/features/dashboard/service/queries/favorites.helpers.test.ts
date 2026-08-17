import { OrderDirection } from '@ens-apps/indexer'
import { describe, expect, it } from 'vitest'
import {
  type FavoriteEntry,
  filterFavoritesBySearch,
  paginateFavorites,
  sortFavorites,
} from './favorites.helpers'

const createFavorite = (label: string, addedAt: number): FavoriteEntry => ({
  label,
  addedAt,
})

describe('favorites.helpers', () => {
  describe('filterFavoritesBySearch', () => {
    const favorites: readonly FavoriteEntry[] = [
      createFavorite('alice.eth', 1000),
      createFavorite('bob.eth', 2000),
      createFavorite('charlie.eth', 3000),
      createFavorite('ALICE-2.eth', 4000),
    ]

    it('should return all favorites when searchQuery is undefined', () => {
      const result = filterFavoritesBySearch(favorites, undefined)
      expect(result).toEqual(favorites)
    })

    it('should return all favorites when searchQuery is empty string', () => {
      const result = filterFavoritesBySearch(favorites, '')
      expect(result).toEqual(favorites)
    })

    it('should filter favorites by search query (case-insensitive)', () => {
      const result = filterFavoritesBySearch(favorites, 'alice')
      expect(result.map((f) => f.label)).toEqual(['alice.eth', 'ALICE-2.eth'])
    })

    it('should filter favorites by partial match', () => {
      const result = filterFavoritesBySearch(favorites, 'ob')
      expect(result.map((f) => f.label)).toEqual(['bob.eth'])
    })

    it('should return empty array when no matches found', () => {
      const result = filterFavoritesBySearch(favorites, 'xyz')
      expect(result).toHaveLength(0)
    })

    it('should handle empty favorites array', () => {
      const result = filterFavoritesBySearch([], 'alice')
      expect(result).toHaveLength(0)
    })
  })

  describe('sortFavorites', () => {
    const favorites: readonly FavoriteEntry[] = [
      createFavorite('charlie.eth', 3000),
      createFavorite('alice.eth', 1000),
      createFavorite('bob.eth', 2000),
    ]

    describe('sort by name', () => {
      it('should sort by name ascending', () => {
        const result = sortFavorites(favorites, 'name', OrderDirection.Asc)
        expect(result.map((f) => f.label)).toEqual([
          'alice.eth',
          'bob.eth',
          'charlie.eth',
        ])
      })

      it('should sort by name descending', () => {
        const result = sortFavorites(favorites, 'name', OrderDirection.Desc)
        expect(result.map((f) => f.label)).toEqual([
          'charlie.eth',
          'bob.eth',
          'alice.eth',
        ])
      })
    })

    describe('sort by addedAt', () => {
      it('should sort by addedAt ascending', () => {
        const result = sortFavorites(favorites, 'addedAt', OrderDirection.Asc)
        expect(result.map((f) => f.label)).toEqual([
          'alice.eth',
          'bob.eth',
          'charlie.eth',
        ])
      })

      it('should sort by addedAt descending', () => {
        const result = sortFavorites(favorites, 'addedAt', OrderDirection.Desc)
        expect(result.map((f) => f.label)).toEqual([
          'charlie.eth',
          'bob.eth',
          'alice.eth',
        ])
      })
    })

    it('should not mutate original array', () => {
      const original = [...favorites]
      sortFavorites(favorites, 'name', OrderDirection.Asc)
      expect(favorites).toEqual(original)
    })

    it('should handle empty array', () => {
      const result = sortFavorites([], 'name', OrderDirection.Asc)
      expect(result).toEqual([])
    })

    it('should handle single item array', () => {
      const single = [createFavorite('only.eth', 1000)]
      const result = sortFavorites(single, 'name', OrderDirection.Asc)
      expect(result).toEqual(single)
    })
  })

  describe('paginateFavorites', () => {
    const favorites: readonly FavoriteEntry[] = [
      createFavorite('a.eth', 1000),
      createFavorite('b.eth', 2000),
      createFavorite('c.eth', 3000),
      createFavorite('d.eth', 4000),
      createFavorite('e.eth', 5000),
    ]

    it('should return first page correctly', () => {
      const result = paginateFavorites(favorites, 1, 2)
      expect(result.favorites.map((f) => f.label)).toEqual(['a.eth', 'b.eth'])
      expect(result.totalCount).toBe(5)
      expect(result.totalPages).toBe(3)
      expect(result.hasNextPage).toBe(true)
      expect(result.hasPrevPage).toBe(false)
      expect(result.startIndex).toBe(1)
      expect(result.endIndex).toBe(2)
    })

    it('should return middle page correctly', () => {
      const result = paginateFavorites(favorites, 2, 2)
      expect(result.favorites.map((f) => f.label)).toEqual(['c.eth', 'd.eth'])
      expect(result.hasNextPage).toBe(true)
      expect(result.hasPrevPage).toBe(true)
      expect(result.startIndex).toBe(3)
      expect(result.endIndex).toBe(4)
    })

    it('should return last page correctly with partial results', () => {
      const result = paginateFavorites(favorites, 3, 2)
      expect(result.favorites.map((f) => f.label)).toEqual(['e.eth'])
      expect(result.hasNextPage).toBe(false)
      expect(result.hasPrevPage).toBe(true)
      expect(result.startIndex).toBe(5)
      expect(result.endIndex).toBe(5)
    })

    it('should handle page size larger than total items', () => {
      const result = paginateFavorites(favorites, 1, 10)
      expect(result.favorites).toHaveLength(5)
      expect(result.totalPages).toBe(1)
      expect(result.hasNextPage).toBe(false)
      expect(result.hasPrevPage).toBe(false)
      expect(result.startIndex).toBe(1)
      expect(result.endIndex).toBe(5)
    })

    it('should handle empty array', () => {
      const result = paginateFavorites([], 1, 10)
      expect(result.favorites).toHaveLength(0)
      expect(result.totalCount).toBe(0)
      expect(result.totalPages).toBe(0)
      expect(result.hasNextPage).toBe(false)
      expect(result.hasPrevPage).toBe(false)
      expect(result.startIndex).toBe(1)
      expect(result.endIndex).toBe(0)
    })

    it('should return empty array for out of bounds page', () => {
      const result = paginateFavorites(favorites, 10, 2)
      expect(result.favorites).toHaveLength(0)
      expect(result.totalCount).toBe(5)
      expect(result.hasNextPage).toBe(false)
      expect(result.hasPrevPage).toBe(true)
    })

    it('should handle exact page boundary', () => {
      const result = paginateFavorites(favorites, 1, 5)
      expect(result.favorites).toHaveLength(5)
      expect(result.totalPages).toBe(1)
      expect(result.hasNextPage).toBe(false)
      expect(result.hasPrevPage).toBe(false)
    })
  })
})
