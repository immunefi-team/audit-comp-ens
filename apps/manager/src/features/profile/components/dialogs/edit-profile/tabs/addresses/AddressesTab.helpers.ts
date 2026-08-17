import { type Address, isAddress, isAddressEqual } from 'viem'
import { getAddressRecordDef } from '@/features/profile/data/records'
import type { AddressRecordValue } from '@/features/profile/types'
import { validateAddressRecordValue } from '@/features/profile/utils/validateAddress'
import {
  type AddressOption,
  BNB_COIN_TYPE,
  BSC_COIN_TYPE,
  ETH_COIN_TYPE,
  evmChainOptions,
  isEvmCoinType,
  otherNetworkOptions,
} from './addressPickerRecords'

export const getAddressValue = (
  addresses: readonly AddressRecordValue[],
  coinType: number,
) => addresses.find((address) => address.coinType === coinType)?.value ?? ''

export const getAddressOption = (coinType: number): AddressOption => {
  const configuredOption = [...evmChainOptions, ...otherNetworkOptions].find(
    (option) => option.coinType === coinType,
  )
  if (configuredOption) return configuredOption

  const record = getAddressRecordDef(coinType)
  return {
    coinType,
    label: record?.name ?? `Address ${coinType}`,
  }
}

export const normalizeAddressRows = (
  addresses: readonly AddressRecordValue[],
): AddressRecordValue[] => {
  const seenCoinTypes = new Set<number>()
  const rows: AddressRecordValue[] = []

  for (const address of addresses) {
    if (seenCoinTypes.has(address.coinType)) continue
    seenCoinTypes.add(address.coinType)
    rows.push({ coinType: address.coinType, value: address.value })
  }

  return rows
}

export const upsertAddress = (
  addresses: readonly AddressRecordValue[],
  coinType: number,
  value: string,
): AddressRecordValue[] => {
  const exists = addresses.some((address) => address.coinType === coinType)
  if (!exists) {
    return normalizeAddressRows([...addresses, { coinType, value }])
  }

  return normalizeAddressRows(
    addresses.map((address) =>
      address.coinType === coinType ? { ...address, value } : address,
    ),
  )
}

export const removeAddress = (
  addresses: readonly AddressRecordValue[],
  coinType: number,
): AddressRecordValue[] =>
  addresses.filter((address) => address.coinType !== coinType)

export interface AddressValidationIssue {
  readonly coinType: number
  readonly message: string
}

export const getAddressValidationErrorMessage = (
  coinType: number,
  value: string,
): string | undefined => validateAddressRecordValue(coinType, value)

export const getAddressValidationIssues = (
  addresses: readonly AddressRecordValue[],
): AddressValidationIssue[] =>
  normalizeAddressRows(addresses).flatMap(({ coinType, value }) => {
    const message = getAddressValidationErrorMessage(coinType, value)
    return message ? [{ coinType, message }] : []
  })

export const applyEthAddressChange = (
  addresses: readonly AddressRecordValue[],
  currentEthAddress: string,
  nextEthAddress: string,
): AddressRecordValue[] =>
  upsertAddress(addresses, ETH_COIN_TYPE, nextEthAddress)
    .map((address) =>
      address.coinType !== ETH_COIN_TYPE &&
      isEvmCoinType(address.coinType) &&
      address.value === currentEthAddress
        ? { ...address, value: nextEthAddress }
        : address,
    )
    .filter(
      (address) =>
        nextEthAddress.trim() !== '' ||
        address.coinType === ETH_COIN_TYPE ||
        !isEvmCoinType(address.coinType),
    )

export const getRecordIcon = (coinType: number) => {
  const record = getAddressRecordDef(coinType)
  if (record?.icon) return record.icon
  if (record?.coinType === BSC_COIN_TYPE) {
    return getAddressRecordDef(BNB_COIN_TYPE)?.icon
  }
  return undefined
}

const getComparableEvmAddress = (value: string): Address | null => {
  const trimmedValue = value.trim()
  const normalizedValue = trimmedValue.replace(/^0X/, '0x')

  return isAddress(normalizedValue, { strict: false })
    ? (normalizedValue as Address)
    : null
}

const isChainSpecificEvmAddress = (value: string, ethAddress: string) => {
  const trimmedValue = value.trim()
  if (trimmedValue === '') return false

  const addressValue = getComparableEvmAddress(trimmedValue)
  const defaultAddressValue = getComparableEvmAddress(ethAddress)

  if (addressValue && defaultAddressValue) {
    return !isAddressEqual(addressValue, defaultAddressValue)
  }

  return trimmedValue !== ethAddress.trim()
}

interface GetVisibleAddressOptionsParams {
  readonly addresses: readonly AddressRecordValue[]
  readonly extraEvmCoinTypes: readonly number[]
  readonly extraOtherCoinTypes: readonly number[]
}

interface GetAddressDisplayStateParams extends GetVisibleAddressOptionsParams {
  readonly ethAddress: string
}

const getVisibleAddressOptions = ({
  addresses,
  extraEvmCoinTypes,
  extraOtherCoinTypes,
}: GetVisibleAddressOptionsParams) => {
  const addressCoinTypes = addresses
    .filter(({ value }) => value.trim() !== '')
    .map(({ coinType }) => coinType)
  const evmCoinTypes = new Set([
    ...evmChainOptions.map(({ coinType }) => coinType),
    ...extraEvmCoinTypes,
    ...addressCoinTypes.filter(isEvmCoinType),
  ])
  const otherCoinTypes = new Set([
    ...otherNetworkOptions.map(({ coinType }) => coinType),
    ...extraOtherCoinTypes,
    ...addressCoinTypes.filter(
      (coinType) => coinType !== ETH_COIN_TYPE && !isEvmCoinType(coinType),
    ),
  ])

  return {
    evmOptions: [...evmCoinTypes].map(getAddressOption),
    otherOptions: [...otherCoinTypes].map(getAddressOption),
  }
}

export const getAddressDisplayState = ({
  addresses,
  ethAddress,
  extraEvmCoinTypes,
  extraOtherCoinTypes,
}: GetAddressDisplayStateParams) => {
  const { evmOptions, otherOptions } = getVisibleAddressOptions({
    addresses,
    extraEvmCoinTypes,
    extraOtherCoinTypes,
  })
  const customEvmOptions = evmOptions.filter((option) => {
    const value = getAddressValue(addresses, option.coinType)
    return isChainSpecificEvmAddress(value, ethAddress)
  })
  const visibleEvmChipOptions = evmOptions.filter(
    (option) =>
      !customEvmOptions.some(
        (customOption) => customOption.coinType === option.coinType,
      ),
  )
  const visibleOtherRows = otherOptions.filter((option) =>
    addresses.some((address) => address.coinType === option.coinType),
  )
  const unavailableEvmCoinTypes = new Set([
    ETH_COIN_TYPE,
    ...evmOptions.map(({ coinType }) => coinType),
  ])
  const unavailableOtherCoinTypes = new Set([
    ETH_COIN_TYPE,
    ...otherOptions.map(({ coinType }) => coinType),
  ])

  return {
    customEvmOptions,
    evmOptions,
    otherOptions,
    unavailableEvmCoinTypes,
    unavailableOtherCoinTypes,
    visibleEvmChipOptions,
    visibleOtherRows,
  }
}
