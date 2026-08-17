import type { AddressRecordValue } from '@/features/profile/types'
import {
  getAddressValidationErrorMessage,
  getAddressValue,
} from './AddressesTab.helpers'
import { AddressIcon } from './AddressIcon'
import { AddressInputRow } from './AddressInputRow'
import { AddressPickerPill } from './AddressPickerPill'
import { type AddressOption, ETH_COIN_TYPE } from './addressPickerRecords'
import { SectionHeader } from './SectionHeader'

interface EvmAddressSectionProps {
  readonly addresses: readonly AddressRecordValue[]
  readonly customEvmOptions: readonly AddressOption[]
  readonly disabled?: boolean
  readonly ethAddress: string
  readonly onAddMore: () => void
  readonly onEthAddressChange: (value: string) => void
  readonly onRemoveAddress: (coinType: number) => void
  readonly onSetAddressValue: (coinType: number, value: string) => void
  readonly onSetChainToEthAddress: (coinType: number) => void
  readonly visibleEvmChipOptions: readonly AddressOption[]
}

export const EvmAddressSection = ({
  addresses,
  customEvmOptions,
  disabled,
  ethAddress,
  onAddMore,
  onEthAddressChange,
  onRemoveAddress,
  onSetAddressValue,
  onSetChainToEthAddress,
  visibleEvmChipOptions,
}: EvmAddressSectionProps) => (
  <>
    <section className="flex flex-col gap-4">
      <SectionHeader
        description="When someone sends funds to your name, it goes to your Ethereum address. Pick which other chains you want your name to work on."
        title="Receive on Ethereum-compatible chains"
      />

      <AddressInputRow
        coinType={ETH_COIN_TYPE}
        disabled={disabled}
        errorMessage={getAddressValidationErrorMessage(
          ETH_COIN_TYPE,
          ethAddress,
        )}
        label="Your Ethereum Address"
        onChange={onEthAddressChange}
        placeholder="0x0000000000000000000000000000000000000000"
        value={ethAddress}
      />

      <div className="flex flex-wrap items-center gap-2">
        {visibleEvmChipOptions.map((option) => {
          const value = getAddressValue(addresses, option.coinType)
          const active = ethAddress.trim() !== '' && value === ethAddress

          return (
            <AddressPickerPill
              active={active}
              disabled={disabled || (!active && ethAddress.trim() === '')}
              icon={
                <AddressIcon
                  coinType={option.coinType}
                  label={option.label}
                  size="xs"
                />
              }
              key={option.coinType}
              label={option.label}
              onClick={() =>
                active
                  ? onRemoveAddress(option.coinType)
                  : onSetChainToEthAddress(option.coinType)
              }
            />
          )
        })}

        <AddressPickerPill
          active={false}
          disabled={disabled || ethAddress.trim() === ''}
          label="Add More"
          onClick={onAddMore}
          variant="text"
        />
      </div>
    </section>

    {customEvmOptions.length > 0 ? (
      <section className="flex flex-col gap-4">
        <SectionHeader
          description="By default, all Ethereum-compatible chains use your main address above. You've set a different address for these:"
          title="Chain-specific addresses"
        />

        <div className="flex flex-col gap-4">
          {customEvmOptions.map((option) => (
            <AddressInputRow
              coinType={option.coinType}
              disabled={disabled}
              errorMessage={getAddressValidationErrorMessage(
                option.coinType,
                getAddressValue(addresses, option.coinType),
              )}
              key={option.coinType}
              label={option.label}
              onChange={(value) => onSetAddressValue(option.coinType, value)}
              onRemove={() => onRemoveAddress(option.coinType)}
              value={getAddressValue(addresses, option.coinType)}
            />
          ))}
        </div>
      </section>
    ) : null}
  </>
)
