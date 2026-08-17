/**
 * Manager-side wrapper around `@ens-apps/smart-account`'s
 * `initializeRhinestoneAccount` (standalone HCA).
 *
 * Responsibilities live here, not in the package:
 *
 *   - Building a viem `Account` from the connected external `WalletClient`
 *     (wagmi).
 *   - Reading manager-specific env vars (`VITE_RHINESTONE_API_KEY`,
 *     `VITE_RHINESTONE_ENDPOINT_URL`, `VITE_RHINESTONE_CUSTOM_RPC_URLS`).
 *   - Injecting the manager's chain (`customSepolia`) and public client.
 *
 * The account is the standalone ENS HCA (single ECDSA owner + scoped
 * SmartSession validator). It is created in-memory with a deterministic address
 * and adopts an existing on-chain HCA after verification; there is NO separate
 * deploy transaction — the first Rhinestone request deploys it lazily.
 */

import {
  type RhinestoneInitResult as CoreRhinestoneInitResult,
  type InitializeRhinestoneAccountParams,
  initializeRhinestoneAccount as initializeRhinestoneAccountCore,
} from '@ens-apps/smart-account'
import { type RhinestoneAccount, walletClientToAccount } from '@rhinestone/sdk'
import type { Account, Address, PublicClient, WalletClient } from 'viem'
import { customSepolia } from '@/lib/wagmi'

export interface RhinestoneConfig {
  chain: typeof customSepolia
  rhinestoneApiKey: string
}

export interface InitializeRhinestoneParams {
  walletClient?: WalletClient
  publicClient: PublicClient
  /** Require the current implementation be trusted (primary-name actions). */
  requireTrustedForPrimary?: boolean
}

export interface RhinestoneInitResult {
  client: RhinestoneAccount
  address: Address
  ownerAddress: Address
  alreadyDeployed: boolean
  config: RhinestoneConfig
}

/**
 * Resolve a viem `Account` + EOA address from the connected external wallet.
 * Throws if no wallet client is available.
 */
function resolveOwnerAccount(params: { walletClient?: WalletClient }): {
  ownerAccount: Account
  eoaAddress: Address
} {
  const { walletClient } = params

  if (walletClient?.account?.address) {
    return {
      ownerAccount: walletClientToAccount(walletClient),
      eoaAddress: walletClient.account.address,
    }
  }

  throw new Error(
    'A walletClient must be provided for Rhinestone initialization',
  )
}

/**
 * Resolve env-derived SDK options.
 *
 * Development is API-key-eligible without `VITE_RHINESTONE_API_KEY`, using the
 * placeholder `'local-dev'`. Deterministic HCA construction and EOA-paid flows
 * such as migration do not call the orchestrator, while local-orchestrator e2e
 * can use the same placeholder. Production remains fail-closed.
 *
 * `VITE_RHINESTONE_CUSTOM_RPC_URLS` is JSON-encoded in the env.
 */
function resolveSdkEnv(): {
  rhinestoneApiKey: string
  rhinestoneEndpointUrl?: string
  rhinestoneCustomRpcUrls?: Record<number, string>
} {
  const endpointUrl = import.meta.env.VITE_RHINESTONE_ENDPOINT_URL || undefined
  const allowsDevPlaceholder = import.meta.env.DEV || !!endpointUrl

  const apiKey =
    import.meta.env.VITE_RHINESTONE_API_KEY ||
    (allowsDevPlaceholder ? 'local-dev' : undefined)

  if (!apiKey) {
    throw new Error(
      'Rhinestone API key not configured in environment variables',
    )
  }

  const customRpcUrlsRaw = import.meta.env.VITE_RHINESTONE_CUSTOM_RPC_URLS
  const customRpcUrls = customRpcUrlsRaw
    ? (JSON.parse(customRpcUrlsRaw) as Record<number, string>)
    : undefined

  return {
    rhinestoneApiKey: apiKey,
    rhinestoneEndpointUrl: endpointUrl,
    rhinestoneCustomRpcUrls: customRpcUrls,
  }
}

/**
 * Initialize the standalone HCA smart account (in-memory; lazy on-chain
 * deploy). Adopts an already-deployed HCA after verification.
 *
 * @throws Error if initialization or adopt-existing verification fails.
 */
export async function initializeRhinestoneAccount(
  params: InitializeRhinestoneParams,
): Promise<RhinestoneInitResult> {
  const { walletClient, publicClient, requireTrustedForPrimary } = params

  const { ownerAccount, eoaAddress } = resolveOwnerAccount({ walletClient })
  const env = resolveSdkEnv()

  const coreParams: InitializeRhinestoneAccountParams = {
    ownerAccount,
    eoaAddress,
    chain: customSepolia,
    publicClient,
    rhinestoneApiKey: env.rhinestoneApiKey,
    rhinestoneEndpointUrl: env.rhinestoneEndpointUrl,
    rhinestoneCustomRpcUrls: env.rhinestoneCustomRpcUrls,
    ...(requireTrustedForPrimary ? { requireTrustedForPrimary } : {}),
  }

  const result: CoreRhinestoneInitResult =
    await initializeRhinestoneAccountCore(coreParams).match(
      (value) => value,
      (error) => {
        throw error
      },
    )

  return {
    client: result.client,
    address: result.address,
    ownerAddress: result.ownerAddress,
    alreadyDeployed: result.alreadyDeployed,
    config: {
      chain: customSepolia,
      rhinestoneApiKey: result.config.rhinestoneApiKey,
    },
  }
}
