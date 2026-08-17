import useLocalStorageState from 'use-local-storage-state'
import type { Address } from 'viem'

type SmartSessionsPreferences = Record<Address, boolean>

export const useSmartSessions = (
  address: Address | undefined,
): readonly [boolean, (enabled: boolean) => void] => {
  const [preferences, setPreferences] =
    useLocalStorageState<SmartSessionsPreferences>('smart-sessions', {
      defaultValue: {},
    })

  const isEnabled = address ? (preferences[address] ?? true) : true

  const setEnabled = (enabled: boolean) => {
    if (!address) return
    setPreferences((prev) => ({ ...prev, [address]: enabled }))
  }

  return [isEnabled, setEnabled] as const
}
