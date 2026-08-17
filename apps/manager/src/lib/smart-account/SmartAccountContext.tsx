'use client'

import { anvilSetupOwner, isTimeTravelEnabled } from '@ens-apps/dev-time-travel'
import {
  buildHcaSessionEnablePayload,
  getValidSessionForAccount,
  type HcaSessionEnablePayload,
  isRhinestoneSession,
  type RhinestoneStoredSession,
  removeSessionsByOwner,
} from '@ens-apps/smart-account'
import type { RhinestoneSigner, Signer } from '@ens-apps/transaction-manager'
import { SUPPORTED_TOKENS } from '@ens-apps/transaction-manager/contracts/ens-sepolia'
import { logger } from '@ens-apps/utils/logger'
import { $qk } from '@ens-apps/utils/tanstack-query/queryKey'
import { useLingui } from '@lingui/react/macro'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useActor, useSelector } from '@xstate/react'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { toast } from 'sonner'
import {
  type Address,
  isAddressEqual,
  type PublicClient,
  type WalletClient,
} from 'viem'
import { useConnection, usePublicClient, useWalletClient } from 'wagmi'
import { type EventFromLogic, waitFor } from 'xstate'
import { customSepolia } from '@/lib/wagmi'
import { backendClient } from '@/utils/backend-client'
import { isFeatureEnabled } from '@/utils/feature-flags'
import { buildSessionContext } from './actors/build-session-signer'
import { resolveSessionActor } from './actors/session.actors'
import { resolveVerifiedOwner, sessionHydrationKey } from './sessionGate'
import {
  selectIsLoading,
  selectIsReady,
  smartAccountMachine,
} from './smart-account.machine'
import type {
  WalletSource as BaseWalletSource,
  RhinestoneAccountState,
} from './types'
import { useSmartAccountBalances } from './useSmartAccountBalances'

export interface SmartAccountContextValue extends RhinestoneAccountState {
  readonly hasInitialized: boolean
  readonly isReady: boolean
  readonly walletClient: WalletClient | null
  readonly infrastructure: 'warp'
  /**
   * Whether a valid time-boxed-owner session is active (registration runs
   * prompt-free). NOT SmartSessions — an ephemeral key added as a temporary HCA
   * owner.
   */
  readonly hasActiveSession: boolean
  /** True while the one-time ENABLE signature is in flight. */
  readonly isEnablingSession: boolean
  /** Last session-enable error message, if any. */
  readonly sessionError: string | null
  /**
   * Ensure a valid time-boxed-owner session exists for the current owner,
   * creating one (the single ENABLE wallet signature that adds the ephemeral
   * key as a temporary HCA owner) if needed. Resolves with the session-attached
   * signer to use IMMEDIATELY (avoids waiting for a React re-render of
   * `signer`), or null on failure / the EOA-only path.
   */
  readonly enableSession: () => Promise<Signer | null>
  /**
   * The active persisted session record for the current HCA, if any. Carries
   * the fields needed to rebuild the session-enable payload for registration.
   */
  readonly activeStoredSession: RhinestoneStoredSession | null
  /**
   * Resolve the `START_REGISTRATION` session-enable payload for the active
   * session. Rebuilt from persisted state with NO wallet prompt and no chain
   * read — it replays the single authorization signature captured at the
   * session gate.
   *
   * Returned for ANY active session, including one already enabled on-chain:
   * the registration machine, not this getter, decides whether to attach it
   * (only alongside a funding permit, which the validator's policy requires).
   * Returns `undefined` only when there is no active session.
   */
  readonly getSessionEnablePayload: () => Promise<
    HcaSessionEnablePayload | undefined
  >
  /**
   * Re-initialize the in-memory smart-account client from the connected wallet.
   * Migration calls this after a direct factory deployment so subsequent HCA
   * reads and actions cannot retain the counterfactual/deployment snapshot.
   */
  readonly refreshAccount: () => Promise<void>
}

const SmartAccountContext = createContext<SmartAccountContextValue | null>(null)

interface SmartAccountContextProviderProps {
  readonly children: ReactNode
}

function detectWalletSource(
  wagmiWalletClient: WalletClient | undefined,
): BaseWalletSource {
  return wagmiWalletClient?.account?.address ? 'external-wallet' : null
}

/**
 * Resolve the Rhinestone API key, allowing a `local-dev` placeholder when a
 * local orchestrator endpoint is configured.
 */
function resolveRhinestoneApiKey(): string | undefined {
  const isLocalOrchestrator = !!import.meta.env.VITE_RHINESTONE_ENDPOINT_URL
  return (
    import.meta.env.VITE_RHINESTONE_API_KEY ||
    (isLocalOrchestrator ? 'local-dev' : undefined)
  )
}

interface BuildRhinestoneSignerParams {
  readonly baseClient: unknown
  readonly accountAddress: Address
  readonly rhinestoneApiKey: string
  readonly sessionContext: RhinestoneSigner['session'] | undefined
  /** Verified owner (machine + wagmi agree), or null on divergence. */
  readonly sessionOwnerAddress: Address | null
  /** For the WEB-287 mismatch log only. */
  readonly machineOwner: Address | null
  readonly eoaAddress: Address | null
}

/**
 * Build the HCA (rhinestone) signer, attaching the time-boxed-owner session
 * ONLY when the owner is verified (WEB-287). A session present without a
 * verified owner means the connected wallet diverged from the HCA owner mid-
 * flight — we drop the session (fall back to the owner-signed path) rather than
 * risk a wrong-owner Intent, and log it.
 */
function buildRhinestoneSigner(
  params: BuildRhinestoneSignerParams,
): RhinestoneSigner {
  const { sessionContext, sessionOwnerAddress } = params
  const attachSession = !!sessionContext && !!sessionOwnerAddress
  if (sessionContext && !sessionOwnerAddress) {
    logger.error(
      'Wallet owner mismatch; refusing to attach session to signer',
      {
        machineOwner: params.machineOwner,
        connectedEoa: params.eoaAddress,
      },
    )
  }
  return {
    type: 'rhinestone' as const,
    account: params.baseClient as unknown as RhinestoneSigner['account'],
    config: {
      chain: customSepolia,
      accountAddress: params.accountAddress,
      rhinestoneApiKey: params.rhinestoneApiKey,
      defaultInfra: 'warp',
    },
    ...(attachSession ? { session: sessionContext } : {}),
  }
}

/**
 * Synchronizes wallet connection state with the smart account state machine.
 * Handles transitions between disconnected and external-wallet states.
 */
function useWalletConnectionSync(
  wagmiWalletClient: WalletClient | undefined,
  wagmiPublicClient: PublicClient | undefined,
  snapshotValue: string,
  send: (event: EventFromLogic<typeof smartAccountMachine>) => void,
) {
  const connectedKeyRef = useRef<string | null>(null)

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: wallet connection transitions must remain ordered to prevent stale sessions during disconnect and account switches.
  useEffect(() => {
    const walletSource = detectWalletSource(wagmiWalletClient)

    const nextKey =
      walletSource === 'external-wallet'
        ? `external-${wagmiWalletClient?.account?.address?.toLowerCase() ?? 'unknown'}`
        : null

    if (!walletSource || !nextKey) {
      connectedKeyRef.current = null
      if (snapshotValue !== 'disconnected') {
        send({ type: 'WALLET_DISCONNECTED' })
      }
      return
    }

    if (connectedKeyRef.current === nextKey) {
      return
    }

    if (snapshotValue !== 'disconnected') {
      send({ type: 'WALLET_DISCONNECTED' })
      return
    }

    if (!wagmiWalletClient || !wagmiPublicClient) return
    send({
      type: 'WALLET_CONNECTED',
      walletSource: 'external-wallet',
      walletClient: wagmiWalletClient,
      publicClient: wagmiPublicClient,
    })
    connectedKeyRef.current = nextKey
  }, [wagmiWalletClient, wagmiPublicClient, snapshotValue, send])
}

/**
 * WEB-287: evict a previous owner's stored session when the connected EOA
 * changes (cross-EOA switch on a shared device) or disconnects. Tracked
 * independently of the connection-sync effect so a stale session — signed by a
 * different owner — is never reused for a newly connected wallet. `onCleared`
 * also drops the in-memory session.
 */
function usePreviousOwnerSessionEviction(
  eoaAddress: Address | null,
  enabled: boolean,
  onCleared: (previousOwner: Address) => void,
) {
  const previousOwnerRef = useRef<Address | null>(null)
  // Hold the latest callback in a ref so the eviction effect reacts ONLY to the
  // EOA changing (an event-style callback), not to `onCleared`'s identity — the
  // caller can pass a fresh closure each render without re-triggering eviction.
  const onClearedRef = useRef(onCleared)
  onClearedRef.current = onCleared

  useEffect(() => {
    if (!enabled) return
    const previous = previousOwnerRef.current
    // Do NOT treat a transient disconnect (eoaAddress → null) as an owner
    // change. wagmi briefly reports `null` during reconnect / HMR / tab focus,
    // and evicting on that wipes the stored session for the SAME owner, forcing
    // a needless re-ENABLE on the next action (and re-deploy paths). Only react
    // to a real switch to a DIFFERENT non-null owner. Keep the last known owner
    // in the ref across null blips so the comparison is against the real prior
    // owner, not the transient null.
    if (!eoaAddress) return
    previousOwnerRef.current = eoaAddress
    if (!previous) return
    if (isAddressEqual(previous, eoaAddress)) return
    onClearedRef.current(previous)
  }, [eoaAddress, enabled])
}

export const SmartAccountContextProvider = ({
  children,
}: SmartAccountContextProviderProps) => {
  const queryClient = useQueryClient()
  const { t } = useLingui()
  const { isConnecting, isReconnecting } = useConnection()
  const { data: wagmiWalletClient } = useWalletClient()
  const wagmiPublicClient = usePublicClient({ chainId: customSepolia.id })

  // True while the connector is still establishing/restoring a session, so
  // we don't report the account as "initialized" mid-reconnect.
  const isWalletPending = isConnecting || isReconnecting

  const [snapshot, send, actorRef] = useActor(smartAccountMachine)

  const isLoading = useSelector(actorRef, selectIsLoading)
  const isReady = useSelector(actorRef, selectIsReady)

  // ── Time-boxed-owner session state ──────────────────────────────────────
  // NOT SmartSessions: the active session is an ephemeral key added as a
  // temporary OWNER of the HCA (the ENABLE signature), for the current owner.
  // Attached to the rhinestone signer so registration Intents are signed by the
  // ephemeral owner key (prompt-free) instead of the connected owner.
  // Declared up here (above the wallet-sync hook) so the disconnect handler can
  // clear it when the owner changes.
  const [activeSession, setActiveSession] =
    useState<RhinestoneStoredSession | null>(null)

  // WEB-287: when the connection leaves a previously-connected owner (disconnect
  // or switch to a different EOA), evict that owner's stored session AND drop
  // the in-memory one. Without this a session enabled by owner A on a shared
  // device could be reused for owner B (the on-chain OwnableValidator would
  // reject it — but better to never attach it). No `useCallback` needed:
  // `removeSessionsByOwner` and `setActiveSession` are stable, and the eviction
  // hook holds this callback in a ref (it isn't an effect dependency).
  const onOwnerCleared = (previousOwner: Address) => {
    removeSessionsByOwner(previousOwner)
    setActiveSession(null)
  }

  // In EOA-only mode the smart-account state machine never runs — skip the
  // wallet sync hook so we don't kick off Rhinestone initialization
  // (which would deploy the HCA via Warp etc.).
  const useEoa = isFeatureEnabled('USE_EOA')
  useWalletConnectionSync(
    useEoa ? undefined : (wagmiWalletClient as WalletClient | undefined),
    useEoa ? undefined : (wagmiPublicClient as PublicClient | undefined),
    snapshot.value as string,
    send,
  )

  const eoaAddress = wagmiWalletClient?.account?.address ?? null

  // Evict a prior owner's session on cross-EOA switch / disconnect (WEB-287).
  // Disabled in EOA-only mode (no sessions there).
  usePreviousOwnerSessionEviction(eoaAddress, !useEoa, onOwnerCleared)
  // In EOA-only mode the wagmi wallet client _is_ the account; otherwise pull
  // both addresses from the smart-account state machine.
  const accountAddress = useEoa ? eoaAddress : snapshot.context.accountAddress
  // Display / balances / funding owner. Funding tops up the connected EOA's
  // stablecoins and is independent of the HCA session, so the legacy
  // machine-owner-with-EOA-fallback is fine here.
  const ownerAddress = useEoa
    ? eoaAddress
    : (snapshot.context.ownerAddress ?? eoaAddress)

  // WEB-287 / EXP-RHN-003: the HCA owner has two independent sources — the
  // state machine (set at HCA init / enable time) and wagmi's connected wallet.
  // For the SESSION/SIGNER path we do NOT fall back to `eoaAddress`: a silent
  // fallback can diverge from the owner that enabled the on-chain session
  // (cross-EOA reconnect / shared device / a transitional snapshot where the
  // machine reset to `disconnected` while wagmi reports a new EOA), and the
  // session machinery is keyed on this address — a divergence would enable /
  // reuse a session for the WRONG owner (register to the wrong owner, or attach
  // a session the on-chain OwnableValidator rejects). Resolve it ONLY when both
  // sources agree (case-insensitive); otherwise it is null and the session
  // paths fail fast. EOA-only mode has no sessions, so this stays null there.
  const sessionOwnerAddress = useEoa
    ? null
    : resolveVerifiedOwner(snapshot.context.ownerAddress, eoaAddress)

  const balances = useSmartAccountBalances({
    accountAddress,
    ownerAddress,
  })

  // Smart account is HCA-only: fund the EOA (which holds the ENS name and
  // stablecoins the smart account spends from). Execution costs are paid
  // by Rhinestone, so the SCA itself doesn't need funding.
  const addressToFund = ownerAddress

  // The (address + balance read) we last kicked off a fund for. We fund at most
  // ONCE per balance read: `balancesUpdatedAt` advances only on a genuine
  // refetch (every 30s, or the post-success invalidation) — never on render or
  // mutation-settle churn — so this both retries transient failures on the next
  // refetch AND can't loop on every render. This is what stops the previous
  // infinite loop / faucet+Para spam.
  const lastFundedKeyRef = useRef<string | null>(null)

  // Dev-only: tracks which owner addresses we've already set up on Anvil so we
  // don't repeat the setCode + mint on every render.
  const anvilSetupDoneRef = useRef<Set<string>>(new Set())

  // Dev-only: clears contract bytecode + mints USDC/DAI on the local Anvil fork
  // for the owner address. Runs whenever ownerAddress becomes available.
  //
  // Gated on `isTimeTravelEnabled()` (DEV + VITE_TIME_TRAVEL), which is the same
  // flag that signals "a local Anvil fork is running". Without it — e.g. dev
  // against real Sepolia — the `/rpc` proxy has no Anvil behind it, so these
  // `anvil_setCode` / mint calls would spam `ECONNREFUSED 127.0.0.1:8545`.
  useEffect(() => {
    if (!isTimeTravelEnabled() || !ownerAddress) return
    if (anvilSetupDoneRef.current.has(ownerAddress)) return

    anvilSetupDoneRef.current.add(ownerAddress)
    anvilSetupOwner(ownerAddress, customSepolia, {
      USDC: SUPPORTED_TOKENS.USDC,
    }).catch(() => {
      anvilSetupDoneRef.current.delete(ownerAddress)
    })
  }, [ownerAddress])

  const autoFundingMutation = useMutation({
    mutationKey: $qk({
      $scope: 'wallet',
      $action: 'fund',
      address: accountAddress,
    }),
    mutationFn: async (address: Address) => {
      toast.loading(t`Funding wallet`, {
        description: t`Funding wallet ${address} with mock USDC & DAI tokens`,
        id: `fund-wallet-${address}`,
      })
      const response = await backendClient.wallet.fund.$post({
        json: { address },
      })
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`)
      }
      return response.json()
    },
    onSuccess: (data, address) => {
      if (!data?.txHash) {
        toast.dismiss(`fund-wallet-${address}`)
        return
      }
      toast.success(t`Wallet funded successfully`, {
        description: t`Wallet ${address} funded successfully`,
        id: `fund-wallet-${address}`,
      })
      queryClient.invalidateQueries({
        queryKey: $qk({
          $scope: 'wallet',
          $action: 'stablecoinBalances',
        }),
      })
    },
    onError: (error, address) => {
      toast.error(t`Failed to fund wallet`, {
        description: t`Failed to fund wallet: ${error.message}`,
        id: `fund-wallet-${address}`,
      })
      // Intentionally keep the latch set for this snapshot. A failed attempt
      // is NOT retried until the balances are genuinely re-read (the 30s
      // refetch produces a new snapshot → new key → one retry). Resetting the
      // latch here would let the effect re-fire the instant `isPending` flips
      // back to false, hammering the faucet (and Para) on persistent errors.
    },
  })

  const { isPending: isFundingPending, mutate: fundWallet } =
    autoFundingMutation

  // Whether the owner is low on stablecoins. Computed here (not inside the
  // effect) and reduced to a stable *boolean* so the funding effect doesn't
  // re-run on the balances array's per-render ref churn — only when the
  // low/healthy verdict actually flips. Sum in whole-token units with exact
  // bigint powers (`10n ** decimals`, not `BigInt(10 ** decimals)`) so
  // 18-decimal DAI never goes through a lossy float.
  const needsStablecoins = useMemo(() => {
    const totalBalance = balances.stablecoinBalances.reduce(
      (acc, balance) =>
        acc + BigInt(balance.balance) / 10n ** BigInt(balance.decimals),
      0n,
    )
    return totalBalance < 500n
  }, [balances.stablecoinBalances])

  useEffect(() => {
    // The faucet mints MockUSDC, which is also the payment token of the
    // standalone-HCA route, so auto-fund runs on real Sepolia too.

    // NOTE: deliberately NOT gated on the smart-account machine's `isLoading`.
    // Funding tops up the EOA owner's stablecoins, which is independent of HCA
    // initialization. The machine can flap disconnected→initializing→ready
    // (Para reconnects, etc.); gating on `isLoading` there meant funding never
    // got a stable window and the EOA stayed at $0. We only need the owner
    // address and a loaded balance read.
    if (
      !addressToFund ||
      balances.isLoadingBalances ||
      // A fund is already in flight — wait for it to settle before deciding
      // whether another is needed.
      isFundingPending
    ) {
      return
    }

    // Fund when the owner is low on stablecoins. The api-worker faucet mints
    // mock USDC/DAI as needed; gated on a low balance so this stays idempotent.
    // (HCA execution costs are paid in USDC and the payment approval is a gasless permit,
    // so the EOA owner never needs native ETH.)
    if (!needsStablecoins) return

    // Fund at most once per distinct (address, balance read). The key only
    // changes when the owner address changes or the balances are genuinely
    // re-read (`balancesUpdatedAt` advances on refetch), so render churn and the
    // in-flight mutation can't re-fire it — while a persistent low balance still
    // retries on the next 30s refetch.
    const fundKey = `${addressToFund}:${balances.balancesUpdatedAt}`
    if (lastFundedKeyRef.current === fundKey) return

    lastFundedKeyRef.current = fundKey
    fundWallet(addressToFund)
  }, [
    addressToFund,
    balances.isLoadingBalances,
    balances.balancesUpdatedAt,
    needsStablecoins,
    isFundingPending,
    fundWallet,
  ])

  const baseClient = snapshot.context.client
  const infrastructure = snapshot.context.infrastructure

  const [isEnablingSession, setIsEnablingSession] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)

  // When the owner changes (incl. initial mount / reconnect), hydrate the
  // active session from localStorage: a valid, non-expired stored session for
  // this owner is reused WITHOUT prompting (the ephemeral key is already an
  // HCA owner on-chain). This makes a 2nd registration within the session's
  // lifetime skip the enable modal entirely. EOA-only mode keeps no session.
  // Key the guard on BOTH addresses. On a page reload mid-registration the
  // owner resolves a tick BEFORE the HCA `accountAddress` does; keying only on
  // the owner would run this effect once (while `accountAddress` is still null,
  // so the lookup is skipped and the session reads as inactive) and then the
  // ref guard would short-circuit the re-run once `accountAddress` arrives —
  // leaving `hasActiveSession=false` and re-prompting ENABLE on every reload
  // even though a valid session is sitting in localStorage. Including the
  // account in the key lets the lookup actually run once both are known.
  const sessionScopeRef = useRef<string | null>(null)
  useEffect(() => {
    const scopeKey = sessionHydrationKey(sessionOwnerAddress, accountAddress)
    if (sessionScopeRef.current === scopeKey) return
    sessionScopeRef.current = scopeKey
    setSessionError(null)

    // No VERIFIED owner (EOA-only mode, or machine/wagmi owner divergence) →
    // never attach a session. Fail closed rather than reuse one for the wrong
    // owner (WEB-287).
    if (!sessionOwnerAddress) {
      setActiveSession(null)
      return
    }
    // Wait until the HCA address is known before attempting reuse — the lookup
    // is scoped to THIS HCA (owner + account + chain). Until then leave the
    // current session state untouched (don't clobber an already-hydrated one).
    if (!accountAddress) return

    // Scope reuse to THIS HCA (owner + chain verified) so a stored session for
    // a different account/chain is never attached — its ephemeral key is not an
    // owner of the current HCA. Mirrors resolveSessionActor's lookup.
    const stored = getValidSessionForAccount({
      accountAddress,
      ownerAddress: sessionOwnerAddress,
      chainId: customSepolia.id,
    })
    setActiveSession(stored && isRhinestoneSession(stored) ? stored : null)
  }, [sessionOwnerAddress, accountAddress])

  const enableSession = useCallback(async (): Promise<Signer | null> => {
    // EOA-only path has no sessions.
    if (isFeatureEnabled('USE_EOA')) return null
    // WEB-287: `sessionOwnerAddress` is the VERIFIED owner (machine + wagmi
    // agree). If it is null while the machine still reports an owner, the
    // connected wallet diverges from the HCA's owner — refuse to enable a
    // session for the wrong owner (it would add the ephemeral key as an owner of
    // the wrong HCA / register to the wrong owner) rather than silently
    // proceeding.
    if (!baseClient || !accountAddress || !sessionOwnerAddress) {
      if (snapshot.context.ownerAddress && eoaAddress && !sessionOwnerAddress) {
        logger.error(
          'Wallet owner mismatch; refusing to enable session signer',
          {
            machineOwner: snapshot.context.ownerAddress,
            connectedEoa: eoaAddress,
          },
        )
      }
      return null
    }
    const rhinestoneApiKey = resolveRhinestoneApiKey()
    if (!rhinestoneApiKey) return null

    const rhinestoneAccount =
      baseClient as unknown as RhinestoneSigner['account']

    if (!wagmiPublicClient) {
      setSessionError('No public client available for session authorization')
      return null
    }

    setIsEnablingSession(true)
    setSessionError(null)
    // The session salt depends on the HCA's on-chain nonce (0 when undeployed).
    const alreadyDeployed = await rhinestoneAccount.isDeployed(customSepolia)
    const result = await resolveSessionActor({
      ownerAddress: sessionOwnerAddress,
      accountAddress,
      chain: customSepolia,
      rhinestoneAccount,
      publicClient: wagmiPublicClient as unknown as PublicClient,
      alreadyDeployed,
    })
    setIsEnablingSession(false)

    if (result.isErr()) {
      setSessionError(result.error.message)
      return null
    }

    // Update state so future renders/intents pick up the session…
    setActiveSession(result.value.session)

    // …AND return a signer with the session attached NOW, so the caller can
    // start registration in the same tick without waiting for a re-render
    // (which would otherwise use the stale, session-less signer). Route through
    // `buildRhinestoneSigner` (rather than re-building the shape inline) so this
    // site stays in sync with the render-path signer and inherits any future
    // defaults/guards. `sessionOwnerAddress` is verified non-null above, so the
    // session is always attached here.
    return buildRhinestoneSigner({
      baseClient,
      accountAddress,
      rhinestoneApiKey,
      sessionContext: buildSessionContext({
        session: result.value.session,
        chain: customSepolia,
        hca: accountAddress,
      }),
      sessionOwnerAddress,
      machineOwner: snapshot.context.ownerAddress,
      eoaAddress,
    })
  }, [
    baseClient,
    accountAddress,
    sessionOwnerAddress,
    snapshot.context.ownerAddress,
    eoaAddress,
    wagmiPublicClient,
  ])

  // Resolve the START_REGISTRATION session-enable payload.
  //
  // Returns the payload for ANY active session — including one already enabled
  // on-chain. It used to short-circuit to `undefined` once
  // `experimental_isSessionEnabled` was true, which broke every registration
  // after the first: dropping the proof forces the validator's steady-state
  // path, where the funding `permit` is rejected with
  // `ActionNotAllowed(USDC, permit)` (masked as `InvalidSignature()`).
  //
  // Re-presenting the proof is safe and costs no extra wallet prompt. The
  // owner's session authorization is signed ONCE and stored; the proof is
  // reusable (`_validateSessionEnableProof` checks only `validUntil` and the
  // account's session nonce, which nothing increments outside revocation), and
  // `enableSessionWithRefund` is idempotent (`_enableSessionFor` rewrites the
  // same slot with identical values).
  //
  // The machine decides whether to ATTACH it: `submittingSetupBundle` sends it
  // only alongside a funding permit, so a fully-funded HCA still gets the cheap
  // commit-only batch.
  const getSessionEnablePayload = useCallback(async (): Promise<
    HcaSessionEnablePayload | undefined
  > => {
    if (!activeSession || !accountAddress) return undefined
    return buildHcaSessionEnablePayload(activeSession)
  }, [activeSession, accountAddress])

  // The session context to attach to the rhinestone signer, if active.
  const sessionContext = useMemo(
    () =>
      activeSession && accountAddress
        ? buildSessionContext({
            session: activeSession,
            chain: customSepolia,
            hca: accountAddress,
          })
        : undefined,
    [activeSession, accountAddress],
  )

  const signer: Signer | null = useMemo(() => {
    // EOA-only mode: skip smart account machinery entirely and sign with the
    // wagmi wallet client directly. This is the only viable signer on the
    // tenderly fork where the Rhinestone relayer is unavailable.
    if (isFeatureEnabled('USE_EOA')) {
      if (!wagmiWalletClient?.account) return null
      return {
        type: 'eoa',
        walletClient: wagmiWalletClient as WalletClient,
      }
    }

    if (!baseClient || !accountAddress) return null

    const rhinestoneApiKey = resolveRhinestoneApiKey()
    if (!rhinestoneApiKey) {
      logger.error('Rhinestone API key not configured - cannot create signer')
      return null
    }

    // HCA signer. A time-boxed-owner session, if active, is attached so
    // registration Intents are signed by the ephemeral session key
    // (prompt-free) via the HCA's preinstalled OwnableValidator — NOT
    // SmartSessions, just an extra owner. `buildRhinestoneSigner` enforces the
    // WEB-287 verified-owner guard before attaching it.
    return buildRhinestoneSigner({
      baseClient,
      accountAddress,
      rhinestoneApiKey,
      sessionContext,
      sessionOwnerAddress,
      machineOwner: snapshot.context.ownerAddress,
      eoaAddress,
    })
  }, [
    baseClient,
    accountAddress,
    wagmiWalletClient,
    sessionContext,
    sessionOwnerAddress,
    snapshot.context.ownerAddress,
    eoaAddress,
  ])

  const isConnected = isFeatureEnabled('USE_EOA')
    ? !!wagmiWalletClient && !!eoaAddress
    : !!snapshot.context.walletSource && !!snapshot.context.client
  const hasInitialized = isFeatureEnabled('USE_EOA')
    ? !isWalletPending
    : !isWalletPending && snapshot.value !== 'initializing'
  const isAccountReady = isFeatureEnabled('USE_EOA')
    ? !!eoaAddress
    : !!snapshot.context.client && !!snapshot.context.accountAddress

  const refreshAccount = useCallback(async (): Promise<void> => {
    if (useEoa) return

    send({ type: 'REFRESH' })
    const refreshed = await waitFor(
      actorRef,
      (next) => next.matches('ready') || next.matches('error'),
      { timeout: 30_000 },
    )
    if (refreshed.matches('error')) {
      throw new Error(
        refreshed.context.error ?? 'Failed to refresh the smart account',
      )
    }
  }, [actorRef, send, useEoa])

  // Memoized so the provider only emits a new value when something it exposes
  // actually changes. Without this the object is rebuilt on every render — the
  // 30s balance polls, the funding mutation and the XState snapshot all churn
  // it — which re-renders every consumer (including the routed `Outlet`) and
  // races TanStack Router's match state during navigation (the `MatchInnerImpl`
  // `throw undefined` that blanks the page). react-query already returns stable
  // refs for unchanged data, so the deps stay stable across no-op renders.
  const contextValue = useMemo<SmartAccountContextValue>(
    () =>
      useEoa
        ? {
            // In EOA-only mode the wagmi wallet client is both the EOA and the
            // "smart account" address. All smart-account-specific fields are
            // zeroed out.
            type: 'rhinestone',
            client: null,
            config: null,
            accountAddress: eoaAddress,
            isLoading: false,
            error: null,
            isConnected,
            walletSource: eoaAddress ? 'external-wallet' : null,
            ownerAddress: eoaAddress,
            stablecoinBalances: balances.stablecoinBalances,
            isLoadingBalances: balances.isLoadingBalances,
            smartAccountEthBalance: balances.smartAccountEthBalance,
            isLoadingSmartAccountEth: balances.isLoadingSmartAccountEth,
            autoFundingMutation,
            signer,
            isAccountReady,
            hasInitialized,
            isReady: isAccountReady,
            walletClient:
              (wagmiWalletClient as WalletClient | undefined) ?? null,
            infrastructure: 'warp',
            hasActiveSession: false,
            isEnablingSession: false,
            sessionError: null,
            enableSession,
            activeStoredSession: null,
            getSessionEnablePayload,
            refreshAccount,
          }
        : {
            type: 'rhinestone',
            client:
              (snapshot.context.client as RhinestoneAccountState['client']) ??
              null,
            config:
              (snapshot.context.config as RhinestoneAccountState['config']) ??
              null,
            accountAddress: snapshot.context.accountAddress,
            isLoading,
            error: snapshot.context.error,
            isConnected,
            walletSource: snapshot.context.walletSource as BaseWalletSource,
            ownerAddress,
            stablecoinBalances: balances.stablecoinBalances,
            isLoadingBalances: balances.isLoadingBalances,
            smartAccountEthBalance: balances.smartAccountEthBalance,
            isLoadingSmartAccountEth: balances.isLoadingSmartAccountEth,
            autoFundingMutation,
            signer,
            isAccountReady,
            hasInitialized,
            isReady,
            walletClient:
              (wagmiWalletClient as WalletClient | undefined) ?? null,
            infrastructure,
            hasActiveSession: !!activeSession,
            isEnablingSession,
            sessionError,
            enableSession,
            activeStoredSession: activeSession,
            getSessionEnablePayload,
            refreshAccount,
          },
    [
      useEoa,
      eoaAddress,
      ownerAddress,
      isConnected,
      isAccountReady,
      hasInitialized,
      isReady,
      isLoading,
      signer,
      autoFundingMutation,
      wagmiWalletClient,
      balances.stablecoinBalances,
      balances.isLoadingBalances,
      balances.smartAccountEthBalance,
      balances.isLoadingSmartAccountEth,
      snapshot.context.client,
      snapshot.context.config,
      snapshot.context.accountAddress,
      snapshot.context.error,
      snapshot.context.walletSource,
      infrastructure,
      activeSession,
      isEnablingSession,
      sessionError,
      enableSession,
      getSessionEnablePayload,
      refreshAccount,
    ],
  )

  return (
    <SmartAccountContext.Provider value={contextValue}>
      {children}
    </SmartAccountContext.Provider>
  )
}

export function useSmartAccountContext(): SmartAccountContextValue {
  const context = useContext(SmartAccountContext)
  if (!context) {
    throw new Error(
      'useSmartAccountContext must be used within SmartAccountProvider',
    )
  }
  return context
}

export function useSmartAccountContextSafe(): SmartAccountContextValue | null {
  return useContext(SmartAccountContext)
}
