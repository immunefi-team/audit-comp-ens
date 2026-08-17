import { describe, expect, it } from 'vitest'
import { mergeCoinTypes, mergeTextKeys } from './mergeRecordKeys'

describe('mergeRecordKeys', () => {
  describe('mergeCoinTypes', () => {
    it('should merge and deduplicate subgraph coins with defaults', () => {
      const subgraphCoins = ['60', '0', '2']
      const defaultCoins = [60, 501]

      const result = mergeCoinTypes(subgraphCoins, defaultCoins)

      expect(result).toEqual([60, 0, 2, 501])
    })

    it('should handle undefined subgraph coins', () => {
      const result = mergeCoinTypes(undefined, [60, 0, 2])

      expect(result).toEqual([60, 0, 2])
    })
  })

  describe('mergeTextKeys', () => {
    it('should merge V1, V2, and default texts', () => {
      const v1Texts = ['name', 'description']
      const v2Texts = ['com.twitter', 'org.telegram']
      const defaultTexts = ['avatar', 'header']

      const result = mergeTextKeys(v1Texts, v2Texts, defaultTexts)

      expect(result).toEqual([
        'name',
        'description',
        'com.twitter',
        'org.telegram',
        'avatar',
        'header',
      ])
    })

    it('should deduplicate text keys', () => {
      const v1Texts = ['name', 'description']
      const v2Texts = ['name', 'com.twitter']
      const defaultTexts = ['name', 'avatar']

      const result = mergeTextKeys(v1Texts, v2Texts, defaultTexts)

      expect(result).toEqual(['name', 'description', 'com.twitter', 'avatar'])
    })

    it('should handle undefined V1 texts', () => {
      const v2Texts = ['com.twitter']
      const defaultTexts = ['name', 'avatar']

      const result = mergeTextKeys(undefined, v2Texts, defaultTexts)

      expect(result).toEqual(['com.twitter', 'name', 'avatar'])
    })
  })
})
