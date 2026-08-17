import { useCallback, useEffect, useState } from 'react'
import { useConnection, useConnectionEffect } from 'wagmi'
import { useSmartAccountContextSafe } from '@/lib/smart-account/SmartAccountContext'

interface UseWalletVerificationOptions {
  enabled?: boolean
  storageKey?: string
}

export const useWalletVerification = ({
  enabled = true,
  storageKey = 'wallet_verified',
}: UseWalletVerificationOptions = {}) => {
  const { address, isConnected } = useConnection()
  const smartAccount = useSmartAccountContextSafe()
  const [showVerifyModal, setShowVerifyModal] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const isExternalWallet = smartAccount?.walletSource === 'external-wallet'

  const getStorageKey = useCallback(
    (addr: `0x${string}`) => `${storageKey}_${addr}`,
    [storageKey],
  )

  const handleVerificationComplete = useCallback(() => {
    if (address && typeof window !== 'undefined') {
      localStorage.setItem(getStorageKey(address), 'true')
      setIsVerified(true)
    }
    setShowVerifyModal(false)
  }, [address, getStorageKey])

  const resetVerification = useCallback(() => {
    if (address && typeof window !== 'undefined') {
      localStorage.removeItem(getStorageKey(address))
    }
    setIsVerified(false)
  }, [address, getStorageKey])

  useConnectionEffect({
    onConnect({ address }) {
      // Skip verification for embedded wallets
      if (
        enabled &&
        isExternalWallet &&
        address &&
        typeof window !== 'undefined'
      ) {
        const wasVerified = localStorage.getItem(getStorageKey(address))
        if (wasVerified === 'true') {
          setIsVerified(true)
        } else {
          setTimeout(() => {
            setShowVerifyModal(true)
          }, 500)
        }
      }
    },
    onDisconnect() {
      setIsVerified(false)
    },
  })

  useEffect(() => {
    // Skip verification for embedded wallets
    if (
      enabled &&
      isExternalWallet &&
      isConnected &&
      address &&
      typeof window !== 'undefined'
    ) {
      const wasVerified = localStorage.getItem(getStorageKey(address))
      if (wasVerified === 'true') {
        setIsVerified(true)
      } else {
        setTimeout(() => {
          setShowVerifyModal(true)
        }, 500)
      }
    }
  }, [enabled, isExternalWallet, isConnected, address, getStorageKey])

  return {
    showVerifyModal,
    setShowVerifyModal,
    handleVerificationComplete,
    resetVerification,
    isVerified,
  }
}
