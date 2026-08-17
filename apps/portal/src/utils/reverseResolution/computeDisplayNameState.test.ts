import { describe, expect, it } from 'vitest'
import { computeDisplayNameState } from './computeDisplayNameState'

describe('computeDisplayNameState', () => {
  describe('L1 (Ethereum mainnet, chainId 60)', () => {
    it('should show name with forward match as primary', () => {
      const result = computeDisplayNameState({
        name: 'vitalik.eth',
        defaultName: null,
        forwardMatch: true,
        reverseRegistrarChainId: 60,
      })

      expect(result).toEqual({
        displayName: 'vitalik.eth',
        isInheritingDefault: false,
        isPrimaryName: true,
        canSetAsPrimary: false,
      })
    })

    it('should show name without forward match as non-primary', () => {
      const result = computeDisplayNameState({
        name: 'vitalik.eth',
        defaultName: null,
        forwardMatch: false,
        reverseRegistrarChainId: 60,
      })

      expect(result).toEqual({
        displayName: 'vitalik.eth',
        isInheritingDefault: false,
        isPrimaryName: false,
        canSetAsPrimary: true,
      })
    })

    it('should not show defaultName on L1', () => {
      const result = computeDisplayNameState({
        name: null,
        defaultName: 'default.eth',
        forwardMatch: false,
        reverseRegistrarChainId: 60,
      })

      expect(result).toEqual({
        displayName: undefined,
        isInheritingDefault: false,
        isPrimaryName: false,
        canSetAsPrimary: false,
      })
    })

    it('should handle no name set', () => {
      const result = computeDisplayNameState({
        name: null,
        defaultName: null,
        forwardMatch: false,
        reverseRegistrarChainId: 60,
      })

      expect(result).toEqual({
        displayName: undefined,
        isInheritingDefault: false,
        isPrimaryName: false,
        canSetAsPrimary: false,
      })
    })
  })

  describe('L2 (Optimism, chainId 10)', () => {
    it('should use name when set and allow completing the forward record', () => {
      const result = computeDisplayNameState({
        name: 'alice.eth',
        defaultName: 'default.eth',
        forwardMatch: false,
        reverseRegistrarChainId: 10,
      })

      // A reverse name set on the L2 registrar without a matching forward
      // `addr(node, l2CoinType)` record is only half of an ENSIP-19 primary —
      // the forward record can be written (on L1) to complete it.
      expect(result).toEqual({
        displayName: 'alice.eth',
        isInheritingDefault: false,
        isPrimaryName: false,
        canSetAsPrimary: true,
      })
    })

    it('should inherit defaultName when no name is set', () => {
      const result = computeDisplayNameState({
        name: null,
        defaultName: 'vitalik.eth',
        forwardMatch: false,
        reverseRegistrarChainId: 10,
      })

      expect(result).toEqual({
        displayName: 'vitalik.eth',
        isInheritingDefault: true,
        isPrimaryName: true,
        canSetAsPrimary: false,
      })
    })

    it('should handle no name and no defaultName', () => {
      const result = computeDisplayNameState({
        name: null,
        defaultName: null,
        forwardMatch: false,
        reverseRegistrarChainId: 10,
      })

      expect(result).toEqual({
        displayName: undefined,
        isInheritingDefault: false,
        isPrimaryName: false,
        canSetAsPrimary: false,
      })
    })

    it('should handle name with forward match', () => {
      const result = computeDisplayNameState({
        name: 'alice.eth',
        defaultName: null,
        forwardMatch: true,
        reverseRegistrarChainId: 10,
      })

      expect(result).toEqual({
        displayName: 'alice.eth',
        isInheritingDefault: false,
        isPrimaryName: true,
        canSetAsPrimary: false,
      })
    })
  })

  describe('Edge cases', () => {
    it('should prioritize name over defaultName on L2', () => {
      const result = computeDisplayNameState({
        name: 'custom.eth',
        defaultName: 'default.eth',
        forwardMatch: false,
        reverseRegistrarChainId: 10,
      })

      expect(result.displayName).toBe('custom.eth')
      expect(result.isInheritingDefault).toBe(false)
    })
  })
})
