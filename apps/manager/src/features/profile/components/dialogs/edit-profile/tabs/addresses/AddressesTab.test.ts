import { describe, expect, it } from 'vitest'
import type { AddressRecordValue } from '@/features/profile/types'
import {
  applyEthAddressChange,
  getAddressDisplayState,
  getAddressOption,
  getAddressValidationErrorMessage,
  getAddressValidationIssues,
  getAddressValue,
  normalizeAddressRows,
  removeAddress,
  upsertAddress,
} from './AddressesTab.helpers'
import {
  BNB_COIN_TYPE,
  BSC_COIN_TYPE,
  ETH_COIN_TYPE,
  evmChainOptions,
  getPickerRecordGroups,
} from './addressPickerRecords'

describe('getPickerRecordGroups', () => {
  it('groups the top five EVM picker-only records without listing all remaining chains', () => {
    const { otherRecords, popularRecords } = getPickerRecordGroups({
      mode: 'evm',
      normalizedSearchValue: '',
      unavailableCoinTypes: new Set([
        ETH_COIN_TYPE,
        ...evmChainOptions.map(({ coinType }) => coinType),
      ]),
    })

    expect(popularRecords.map(({ name }) => name)).toEqual([
      'Zora',
      'Scroll',
      'Linea',
      'Celo',
      'Gnosis',
    ])
    expect(otherRecords).toEqual([])
  })

  it('keeps popular picker-only EVM chains visible while filtering remaining chains', () => {
    const { otherRecords, popularRecords } = getPickerRecordGroups({
      mode: 'evm',
      normalizedSearchValue: 'metis',
      unavailableCoinTypes: new Set([
        ETH_COIN_TYPE,
        ...evmChainOptions.map(({ coinType }) => coinType),
      ]),
    })

    expect(popularRecords.map(({ name }) => name)).toEqual([
      'Zora',
      'Scroll',
      'Linea',
      'Celo',
      'Gnosis',
    ])
    expect(otherRecords.map(({ name }) => name)).toEqual(['Metis'])
  })

  it('keeps popular picker-only other-network chains visible while filtering remaining chains', () => {
    const { otherRecords, popularRecords } = getPickerRecordGroups({
      mode: 'other',
      normalizedSearchValue: 'monero',
      unavailableCoinTypes: new Set([ETH_COIN_TYPE, 0, 501, BNB_COIN_TYPE]),
    })

    expect(popularRecords.map(({ name }) => name)).toEqual([
      'Litecoin',
      'Dogecoin',
      'Reddcoin',
      'Dash',
      'Peercoin',
    ])
    expect(otherRecords.map(({ name }) => name)).toEqual(['Monero'])
  })
})

describe('address row helpers', () => {
  const ethAddress = '0x1111111111111111111111111111111111111111'
  const nextEthAddress = '0x2222222222222222222222222222222222222222'
  const customBaseAddress = '0x3333333333333333333333333333333333333333'
  const baseCoinType = 2147492101
  const optimismCoinType = 2147483658
  const bitcoinCoinType = 0

  const address = (coinType: number, value: string): AddressRecordValue => ({
    coinType,
    value,
  })

  it('normalizes address rows by keeping the first row for each coin type', () => {
    expect(
      normalizeAddressRows([
        address(ETH_COIN_TYPE, ethAddress),
        address(baseCoinType, customBaseAddress),
        address(ETH_COIN_TYPE, nextEthAddress),
      ]),
    ).toEqual([
      address(ETH_COIN_TYPE, ethAddress),
      address(baseCoinType, customBaseAddress),
    ])
  })

  it('upserts address rows without introducing duplicate coin types', () => {
    expect(
      upsertAddress(
        [
          address(ETH_COIN_TYPE, ethAddress),
          address(baseCoinType, customBaseAddress),
          address(baseCoinType, ethAddress),
        ],
        baseCoinType,
        nextEthAddress,
      ),
    ).toEqual([
      address(ETH_COIN_TYPE, ethAddress),
      address(baseCoinType, nextEthAddress),
    ])

    expect(
      upsertAddress(
        [address(ETH_COIN_TYPE, ethAddress)],
        BNB_COIN_TYPE,
        'bnb1',
      ),
    ).toEqual([
      address(ETH_COIN_TYPE, ethAddress),
      address(BNB_COIN_TYPE, 'bnb1'),
    ])
  })

  it('removes every row matching the coin type', () => {
    expect(
      removeAddress(
        [
          address(ETH_COIN_TYPE, ethAddress),
          address(baseCoinType, customBaseAddress),
          address(baseCoinType, ethAddress),
        ],
        baseCoinType,
      ),
    ).toEqual([address(ETH_COIN_TYPE, ethAddress)])
  })

  it('reads configured and fallback address option labels', () => {
    expect(getAddressOption(baseCoinType)).toEqual({
      coinType: baseCoinType,
      label: 'Base',
    })
    expect(getAddressOption(123_456_789)).toEqual({
      coinType: 123_456_789,
      label: 'Address 123456789',
    })
  })

  it('returns an empty string when an address row is missing', () => {
    expect(
      getAddressValue([address(ETH_COIN_TYPE, ethAddress)], baseCoinType),
    ).toBe('')
  })

  it('propagates Ethereum address changes to mirrored EVM rows only', () => {
    expect(
      applyEthAddressChange(
        [
          address(ETH_COIN_TYPE, ethAddress),
          address(optimismCoinType, ethAddress),
          address(baseCoinType, customBaseAddress),
          address(bitcoinCoinType, 'bc1qcustom'),
        ],
        ethAddress,
        nextEthAddress,
      ),
    ).toEqual([
      address(ETH_COIN_TYPE, nextEthAddress),
      address(optimismCoinType, nextEthAddress),
      address(baseCoinType, customBaseAddress),
      address(bitcoinCoinType, 'bc1qcustom'),
    ])
  })

  it('keeps only ETH and non-EVM rows when the Ethereum address is cleared', () => {
    expect(
      applyEthAddressChange(
        [
          address(ETH_COIN_TYPE, ethAddress),
          address(optimismCoinType, ethAddress),
          address(baseCoinType, customBaseAddress),
          address(bitcoinCoinType, 'bc1qcustom'),
        ],
        ethAddress,
        '',
      ),
    ).toEqual([
      address(ETH_COIN_TYPE, ''),
      address(bitcoinCoinType, 'bc1qcustom'),
    ])
  })

  it('derives visible chip rows, custom EVM rows, other-network rows, and unavailable picker sets', () => {
    const state = getAddressDisplayState({
      addresses: [
        address(ETH_COIN_TYPE, ethAddress),
        address(optimismCoinType, ethAddress),
        address(baseCoinType, customBaseAddress),
        address(bitcoinCoinType, 'bc1qcustom'),
        address(123_456_789, 'custom-other'),
      ],
      ethAddress,
      extraEvmCoinTypes: [BSC_COIN_TYPE],
      extraOtherCoinTypes: [123_456_789],
    })

    expect(state.customEvmOptions).toEqual([
      { coinType: baseCoinType, label: 'Base' },
    ])
    expect(
      state.visibleEvmChipOptions.map(({ coinType }) => coinType),
    ).toContain(optimismCoinType)
    expect(
      state.visibleEvmChipOptions.map(({ coinType }) => coinType),
    ).not.toContain(baseCoinType)
    expect(state.visibleOtherRows).toEqual([
      { coinType: bitcoinCoinType, label: 'Bitcoin' },
      { coinType: 123_456_789, label: 'Address 123456789' },
    ])
    expect(state.unavailableEvmCoinTypes.has(BSC_COIN_TYPE)).toBe(true)
    expect(state.unavailableOtherCoinTypes.has(123_456_789)).toBe(true)
  })

  it('does not render the chain-specific section when EVM rows mirror the Ethereum address', () => {
    const state = getAddressDisplayState({
      addresses: [
        address(ETH_COIN_TYPE, ethAddress),
        address(optimismCoinType, ethAddress.toUpperCase()),
        address(baseCoinType, `  ${ethAddress}  `),
      ],
      ethAddress,
      extraEvmCoinTypes: [],
      extraOtherCoinTypes: [],
    })

    expect(state.customEvmOptions).toEqual([])
    expect(state.visibleEvmChipOptions.map(({ coinType }) => coinType)).toEqual(
      expect.arrayContaining([optimismCoinType, baseCoinType]),
    )
  })

  it('keeps inactive preset EVM chains outside of the picker because they are already visible as quick chips', () => {
    const state = getAddressDisplayState({
      addresses: [address(ETH_COIN_TYPE, ethAddress)],
      ethAddress,
      extraEvmCoinTypes: [],
      extraOtherCoinTypes: [],
    })

    expect(state.visibleEvmChipOptions.map(({ coinType }) => coinType)).toEqual(
      expect.arrayContaining([optimismCoinType, baseCoinType]),
    )
    expect(state.unavailableEvmCoinTypes.has(optimismCoinType)).toBe(true)
    expect(state.unavailableEvmCoinTypes.has(baseCoinType)).toBe(true)
  })

  it('hides preset chain-specific EVM records from popular chips and the add-more picker', () => {
    const state = getAddressDisplayState({
      addresses: [
        address(ETH_COIN_TYPE, ethAddress),
        address(baseCoinType, customBaseAddress),
      ],
      ethAddress,
      extraEvmCoinTypes: [],
      extraOtherCoinTypes: [],
    })

    expect(state.customEvmOptions).toEqual([
      { coinType: baseCoinType, label: 'Base' },
    ])
    expect(
      state.visibleEvmChipOptions.map(({ coinType }) => coinType),
    ).not.toContain(baseCoinType)
    expect(state.unavailableEvmCoinTypes.has(baseCoinType)).toBe(true)
  })

  it('does not return a validation error for empty address values', () => {
    expect(getAddressValidationErrorMessage(ETH_COIN_TYPE, '')).toBeUndefined()
  })

  it('validates Ethereum-compatible address values', () => {
    expect(
      getAddressValidationErrorMessage(
        ETH_COIN_TYPE,
        '0x1111111111111111111111111111111111111111',
      ),
    ).toBeUndefined()
    expect(
      getAddressValidationErrorMessage(ETH_COIN_TYPE, 'not-an-address'),
    ).toBe('Enter a valid Ethereum address')
    expect(
      getAddressValidationErrorMessage(baseCoinType, 'not-an-address'),
    ).toBe('Enter a valid Base address')
  })

  it('validates non-EVM address values with their coin encoder', () => {
    expect(
      getAddressValidationErrorMessage(
        bitcoinCoinType,
        '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
      ),
    ).toBeUndefined()
    expect(getAddressValidationErrorMessage(bitcoinCoinType, 'not-btc')).toBe(
      'Enter a valid Bitcoin address',
    )
  })

  it('returns validation issues for every invalid address row', () => {
    expect(
      getAddressValidationIssues([
        address(ETH_COIN_TYPE, 'not-an-address'),
        address(baseCoinType, 'still-not-an-address'),
        address(bitcoinCoinType, 'not-btc'),
        address(123_456_789, 'unsupported'),
      ]),
    ).toEqual([
      { coinType: ETH_COIN_TYPE, message: 'Enter a valid Ethereum address' },
      { coinType: baseCoinType, message: 'Enter a valid Base address' },
      { coinType: bitcoinCoinType, message: 'Enter a valid Bitcoin address' },
      {
        coinType: 123_456_789,
        message: 'Unsupported address type',
      },
    ])
  })
})
