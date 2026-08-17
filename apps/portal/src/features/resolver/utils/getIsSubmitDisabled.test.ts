import { describe, expect, it } from 'vitest'
import { getIsSubmitDisabled } from './getIsSubmitDisabled'

const validAddress = '0x1234567890123456789012345678901234567890'

const baseParams = {
  walletOk: true,
  useCustomResolver: false,
  resolverAddress: '',
  deployNewResolver: false,
  selectedExistingResolver: '',
}

describe('getIsSubmitDisabled', () => {
  it('returns true when !walletOk', () => {
    expect(getIsSubmitDisabled({ ...baseParams, walletOk: false })).toBe(true)
  })

  describe('useCustomResolver', () => {
    it('returns true when resolverAddress is empty', () => {
      expect(
        getIsSubmitDisabled({
          ...baseParams,
          useCustomResolver: true,
          resolverAddress: '',
        }),
      ).toBe(true)
    })

    it('returns true when resolverAddress is invalid', () => {
      expect(
        getIsSubmitDisabled({
          ...baseParams,
          useCustomResolver: true,
          resolverAddress: 'not-an-address',
        }),
      ).toBe(true)
    })

    it('returns false when resolverAddress is valid', () => {
      expect(
        getIsSubmitDisabled({
          ...baseParams,
          useCustomResolver: true,
          resolverAddress: validAddress,
        }),
      ).toBe(false)
    })
  })

  describe('deployNewResolver', () => {
    it('returns false when deployNewResolver is true', () => {
      expect(
        getIsSubmitDisabled({
          ...baseParams,
          useCustomResolver: false,
          deployNewResolver: true,
        }),
      ).toBe(false)
    })
  })

  describe('select existing resolver', () => {
    it('returns true when selectedExistingResolver is empty', () => {
      expect(
        getIsSubmitDisabled({
          ...baseParams,
          useCustomResolver: false,
          deployNewResolver: false,
          selectedExistingResolver: '',
        }),
      ).toBe(true)
    })

    it('returns true when selectedExistingResolver is invalid', () => {
      expect(
        getIsSubmitDisabled({
          ...baseParams,
          useCustomResolver: false,
          deployNewResolver: false,
          selectedExistingResolver: 'invalid',
        }),
      ).toBe(true)
    })

    it('returns false when selectedExistingResolver is valid', () => {
      expect(
        getIsSubmitDisabled({
          ...baseParams,
          useCustomResolver: false,
          deployNewResolver: false,
          selectedExistingResolver: validAddress,
        }),
      ).toBe(false)
    })
  })
})
