/**
 * SmartAccountContext Tests
 *
 * Tests for the React context provider and hooks.
 */

// biome-ignore-all lint/suspicious/noExplicitAny: Test mocks require flexible typing
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import './SmartAccountContext.mocks'

// WEB-287: keep all the real session-storage helpers (the context imports
// several) but spy on `removeSessionsByOwner` to assert cross-EOA eviction.
vi.mock('@ens-apps/smart-account', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@ens-apps/smart-account')>()
  return { ...actual, removeSessionsByOwner: vi.fn() }
})

// Keep the dev-only Anvil owner setup out of these tests.
vi.mock('@ens-apps/dev-time-travel', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@ens-apps/dev-time-travel')>()
  return { ...actual, isTimeTravelEnabled: () => false }
})

import { removeSessionsByOwner } from '@ens-apps/smart-account'
import { useWalletClient } from 'wagmi'
import { backendClient } from '@/utils/backend-client'
import { initializeRhinestoneAccount } from './rhinestone'
import {
  SmartAccountContextProvider,
  useSmartAccountContext,
  useSmartAccountContextSafe,
} from './SmartAccountContext'

const removeSessionsByOwnerMock =
  removeSessionsByOwner as unknown as ReturnType<typeof vi.fn>

const fundPost = backendClient.wallet.fund.$post as unknown as ReturnType<
  typeof vi.fn
>

i18n.loadAndActivate({ locale: 'en', messages: {} })

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: ReactNode }) => (
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <SmartAccountContextProvider>{children}</SmartAccountContextProvider>
      </QueryClientProvider>
    </I18nProvider>
  )
}

describe('SmartAccountContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useSmartAccountContext', () => {
    it('throws error when used outside provider', () => {
      const queryClient = new QueryClient()
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      )

      expect(() => {
        renderHook(() => useSmartAccountContext(), { wrapper })
      }).toThrow(
        'useSmartAccountContext must be used within SmartAccountProvider',
      )
    })

    it('returns context when used inside provider', () => {
      const { result } = renderHook(() => useSmartAccountContext(), {
        wrapper: createWrapper(),
      })

      expect(result.current).toBeDefined()
      expect(result.current.type).toBe('rhinestone')
    })
  })

  describe('useSmartAccountContextSafe', () => {
    it('returns null when used outside provider', () => {
      const queryClient = new QueryClient()
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      )

      const { result } = renderHook(() => useSmartAccountContextSafe(), {
        wrapper,
      })

      expect(result.current).toBeNull()
    })

    it('returns context when used inside provider', () => {
      const { result } = renderHook(() => useSmartAccountContextSafe(), {
        wrapper: createWrapper(),
      })

      expect(result.current).not.toBeNull()
      expect(result.current?.type).toBe('rhinestone')
    })
  })

  describe('wallet initialization', () => {
    it('initializes with no wallet connected', async () => {
      const { result } = renderHook(() => useSmartAccountContext(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.hasInitialized).toBe(true)
      })

      expect(result.current.isConnected).toBe(false)
      expect(result.current.client).toBeNull()
      expect(result.current.accountAddress).toBeNull()
    })

    it('initializes Rhinestone for external wallet', async () => {
      vi.mocked(useWalletClient).mockReturnValue({
        data: {
          account: { address: '0xExternalWallet12345678901234567890123456' },
        },
      } as any)

      const { result } = renderHook(() => useSmartAccountContext(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isAccountReady).toBe(true)
      })

      expect(initializeRhinestoneAccount).toHaveBeenCalled()
      expect(result.current.walletSource).toBe('external-wallet')
    })
  })

  describe('signer creation', () => {
    it('creates signer when client and address are available', async () => {
      vi.mocked(useWalletClient).mockReturnValue({
        data: {
          account: { address: '0xExternalWallet12345678901234567890123456' },
        },
      } as any)

      const { result } = renderHook(() => useSmartAccountContext(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isAccountReady).toBe(true)
      })

      expect(result.current.signer).not.toBeNull()
      expect(result.current.signer?.type).toBe('rhinestone')
    })

    it('returns null signer when not initialized', () => {
      const { result } = renderHook(() => useSmartAccountContext(), {
        wrapper: createWrapper(),
      })

      expect(result.current.signer).toBeNull()
    })
  })

  describe('auto-funding', () => {
    beforeEach(() => {
      fundPost.mockReset()
    })

    // Regression for the auto-fund infinite loop: the balances query returns a
    // fresh `[]` (new ref) on most renders, and the mutation object/`mutate`
    // identity also churns. The effect must dedupe per balance *read* (a stable
    // `balancesUpdatedAt`), NOT per render or per mutation settle — otherwise it
    // re-fires every render and hammers the faucet.
    it('fires auto-fund once for a low balance and does not loop', async () => {
      vi.mocked(useWalletClient).mockReturnValue({
        data: {
          account: { address: '0xExternalWallet12345678901234567890123456' },
        },
      } as any)

      // Succeeds (txHash:null = faucet says already-funded / nothing minted),
      // which settles the mutation. A correctly-deduped effect must NOT keep
      // re-firing just because the mutation settled or the component re-rendered.
      fundPost.mockResolvedValue({ ok: true, json: () => ({ txHash: null }) })

      renderHook(() => useSmartAccountContext(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(fundPost).toHaveBeenCalledTimes(1)
      })

      // Settle + several render cycles must not produce more calls. (Before the
      // fix, the settle-counter bump made this climb without bound.)
      await new Promise((resolve) => setTimeout(resolve, 100))
      expect(fundPost).toHaveBeenCalledTimes(1)
    })

    // The in-flight mutation must not be re-triggered by render churn while it
    // is still pending.
    it('does not fire a fresh fund while one is in flight', async () => {
      vi.mocked(useWalletClient).mockReturnValue({
        data: {
          account: { address: '0xExternalWallet12345678901234567890123456' },
        },
      } as any)

      // Never resolves: the fund stays pending. Exactly one request in flight.
      fundPost.mockReturnValue(new Promise(() => {}))

      renderHook(() => useSmartAccountContext(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(fundPost).toHaveBeenCalledTimes(1)
      })
      // Give the effect time to (incorrectly) re-fire; it must not.
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(fundPost).toHaveBeenCalledTimes(1)
    })
  })

  // WEB-287 / EXP-RHN-003: a session enabled by owner A on a shared device must
  // not survive a switch to owner B. When the connected EOA changes, the
  // previous owner's stored session is evicted.
  describe('cross-EOA session eviction', () => {
    const EOA_A = '0xAAAA000000000000000000000000000000000001'
    const EOA_B = '0xBBBB000000000000000000000000000000000002'

    beforeEach(() => {
      removeSessionsByOwnerMock.mockClear()
    })

    it('evicts the previous owner session when the connected EOA changes', async () => {
      vi.mocked(useWalletClient).mockReturnValue({
        data: { account: { address: EOA_A } },
      } as any)

      const { rerender } = renderHook(() => useSmartAccountContext(), {
        wrapper: createWrapper(),
      })

      // Owner A connects and initializes — no eviction yet.
      await waitFor(() => {
        expect(initializeRhinestoneAccount).toHaveBeenCalled()
      })
      expect(removeSessionsByOwnerMock).not.toHaveBeenCalled()

      // Switch the connected wallet to owner B.
      vi.mocked(useWalletClient).mockReturnValue({
        data: { account: { address: EOA_B } },
      } as any)
      rerender()

      // The previous owner (A) — and only A — has its session evicted.
      await waitFor(() => {
        expect(removeSessionsByOwnerMock).toHaveBeenCalledWith(EOA_A)
      })
      expect(removeSessionsByOwnerMock).not.toHaveBeenCalledWith(EOA_B)
    })

    it('does NOT evict on a transient disconnect (eoa → null)', async () => {
      // A disconnect blip (wagmi briefly reports null during reconnect / HMR /
      // tab focus) must NOT wipe the owner's session — that forced a needless
      // re-ENABLE on every reconnect. The session survives so the next action
      // reuses it prompt-free (per the HCA handoff doc). Cross-owner safety is
      // preserved by the different-EOA-switch case above.
      vi.mocked(useWalletClient).mockReturnValue({
        data: { account: { address: EOA_A } },
      } as any)

      const { rerender } = renderHook(() => useSmartAccountContext(), {
        wrapper: createWrapper(),
      })

      // Owner A connects and initializes — no eviction yet.
      await waitFor(() => {
        expect(initializeRhinestoneAccount).toHaveBeenCalled()
      })
      expect(removeSessionsByOwnerMock).not.toHaveBeenCalled()

      // Disconnect: wagmi reports no wallet client (eoaAddress → null).
      vi.mocked(useWalletClient).mockReturnValue({ data: null } as any)
      rerender()

      // No eviction on the null blip.
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(removeSessionsByOwnerMock).not.toHaveBeenCalled()

      // Reconnecting the SAME owner still must not evict.
      vi.mocked(useWalletClient).mockReturnValue({
        data: { account: { address: EOA_A } },
      } as any)
      rerender()
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(removeSessionsByOwnerMock).not.toHaveBeenCalled()
    })

    it('does NOT evict on a plain re-render with the same EOA', async () => {
      vi.mocked(useWalletClient).mockReturnValue({
        data: { account: { address: EOA_A } },
      } as any)

      const { rerender } = renderHook(() => useSmartAccountContext(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(initializeRhinestoneAccount).toHaveBeenCalled()
      })

      rerender()
      rerender()

      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(removeSessionsByOwnerMock).not.toHaveBeenCalled()
    })
  })
})
