import { useState } from 'react'
import type {
  AddressRecordValue,
  ProfileRecords,
} from '@/features/profile/types'
import { useEditProfileDialogStatus } from '../../EditProfileDialog.context'
import {
  applyEthAddressChange,
  getAddressDisplayState,
  getAddressValue,
  normalizeAddressRows,
  removeAddress,
  upsertAddress,
} from './AddressesTab.helpers'
import { ETH_COIN_TYPE, type PickerMode } from './addressPickerRecords'
import { ChainPickerDialog } from './ChainPickerDialog'
import { EvmAddressSection } from './EvmAddressSection'
import { OtherNetworksSection } from './OtherNetworksSection'

interface AddressesTabProps {
  readonly onAddressesChange: (addresses: ProfileRecords['addresses']) => void
  readonly values: ProfileRecords
}

export const AddressesTab = ({
  onAddressesChange,
  values,
}: AddressesTabProps) => {
  const { isSaving } = useEditProfileDialogStatus()
  const [pickerMode, setPickerMode] = useState<PickerMode | null>(null)
  const [extraEvmCoinTypes, setExtraEvmCoinTypes] = useState<number[]>([])
  const [extraOtherCoinTypes, setExtraOtherCoinTypes] = useState<number[]>([])
  const ethAddress = getAddressValue(values.addresses, ETH_COIN_TYPE)
  const {
    customEvmOptions,
    otherOptions,
    unavailableEvmCoinTypes,
    unavailableOtherCoinTypes,
    visibleEvmChipOptions,
    visibleOtherRows,
  } = getAddressDisplayState({
    addresses: values.addresses,
    ethAddress,
    extraEvmCoinTypes,
    extraOtherCoinTypes,
  })

  const updateAddresses = (
    getNextAddresses: (
      addresses: readonly AddressRecordValue[],
    ) => readonly AddressRecordValue[],
  ) => {
    onAddressesChange(normalizeAddressRows(getNextAddresses(values.addresses)))
  }

  const handleEthAddressChange = (value: string) => {
    updateAddresses((addresses) =>
      applyEthAddressChange(addresses, ethAddress, value),
    )
  }

  const setAddressValue = (coinType: number, value: string) => {
    updateAddresses((addresses) => upsertAddress(addresses, coinType, value))
  }

  const setChainToEthAddress = (coinType: number) => {
    setAddressValue(coinType, ethAddress)
  }

  const removeAddressValue = (coinType: number) => {
    updateAddresses((addresses) => removeAddress(addresses, coinType))
  }

  const addAddressRows = (coinTypes: readonly number[], value: string) => {
    updateAddresses((addresses) =>
      coinTypes.reduce(
        (nextAddresses, coinType) =>
          upsertAddress(nextAddresses, coinType, value),
        addresses,
      ),
    )
  }

  const handlePickerAdd = (coinTypes: readonly number[]) => {
    if (pickerMode === 'evm') {
      setExtraEvmCoinTypes((current) => [
        ...new Set([...current, ...coinTypes]),
      ])
      addAddressRows(coinTypes, ethAddress)
      return
    }

    setExtraOtherCoinTypes((current) => [
      ...new Set([...current, ...coinTypes]),
    ])
    addAddressRows(coinTypes, '')
  }

  return (
    <div className="flex flex-col gap-6 pb-4">
      <EvmAddressSection
        addresses={values.addresses}
        customEvmOptions={customEvmOptions}
        disabled={isSaving}
        ethAddress={ethAddress}
        onAddMore={() => setPickerMode('evm')}
        onEthAddressChange={handleEthAddressChange}
        onRemoveAddress={removeAddressValue}
        onSetAddressValue={setAddressValue}
        onSetChainToEthAddress={setChainToEthAddress}
        visibleEvmChipOptions={visibleEvmChipOptions}
      />

      <OtherNetworksSection
        addresses={values.addresses}
        disabled={isSaving}
        onAddMore={() => setPickerMode('other')}
        onRemoveAddress={removeAddressValue}
        onSetAddressValue={setAddressValue}
        otherOptions={otherOptions}
        visibleOtherRows={visibleOtherRows}
      />

      <ChainPickerDialog
        disabled={isSaving}
        mode={pickerMode ?? 'evm'}
        onAdd={handlePickerAdd}
        onOpenChange={(open) =>
          setPickerMode(open ? (pickerMode ?? 'evm') : null)
        }
        open={pickerMode !== null}
        unavailableCoinTypes={
          pickerMode === 'other'
            ? unavailableOtherCoinTypes
            : unavailableEvmCoinTypes
        }
      />
    </div>
  )
}
