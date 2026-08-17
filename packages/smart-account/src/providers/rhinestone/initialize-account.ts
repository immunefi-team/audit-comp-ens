/**
 * Standalone-HCA account initialization.
 *
 * Creates (or adopts) the ENS **standalone** Hidden Contract Account via the
 * patched Rhinestone SDK (`@rhinestone/sdk@1.8.0` + the standalone-HCA patch).
 *
 * Model (per the "HCA: New" handoff doc):
 *   - `account: { type: 'hca', version: 'ens-standalone-1.1.0', … }` selects the
 *     standalone implementation (a VerifiableFactory proxy over
 *     `StandaloneHCAImplementation`, deployed by `StandaloneHCAFactory`).
 *   - `owners: { type: 'ecdsa', accounts: [walletOwner], module: validator }` —
 *     EXACTLY ONE ECDSA owner. No `ownerExpirations`, no `updateConfig`, no
 *     `type: 'ens'` (that was the old ephemeral-owner model this replaces).
 *   - `experimental_sessions: { enabled: true, module: validator }` — the
 *     standalone validator supports scoped SmartSessions (the old locked-module
 *     HCA did not).
 *   - `userSalt: 0n`. No `initData` when creating fresh; the SDK derives the HCA
 *     address from owner + implementation + salt. Registration may deploy it
 *     lazily in the first Rhinestone request, while direct-owner flows can use
 *     `getInitData()` to submit the same factory deployment from the wallet.
 *
 * Adopt-existing: if the derived address already has code, we verify the
 * remediated factory's immutable `authorizedOwnerOf(HCA)` certificate plus the
 * account's `owner()` / `accountId()` and
 * `VerifiableFactory.verifyContract(...)`. On any mismatch we throw — we NEVER
 * silently select a different HCA.
 *
 * The caller injects the viem `Account` (Para/MetaMask/hardware wrapping is the
 * app's concern), the chain, and the Rhinestone API key + endpoint overrides.
 */

import type { AccountProviderConfig, RhinestoneAccount } from '@rhinestone/sdk'
import { RhinestoneSDK } from '@rhinestone/sdk'
import { errAsync, fromPromise, type ResultAsync } from 'neverthrow'
import {
  type Account,
  type Address,
  type Chain,
  decodeFunctionData,
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  isAddressEqual,
  keccak256,
  type PublicClient,
  parseAbi,
} from 'viem'
import { AccountInitError, AccountVerificationError } from '../../errors'
import { computeVerifiableProxyAddress } from '../../verifiable-factory'
import {
  getDestinationContracts,
  ONCHAIN_ACCOUNT_ID,
  STANDALONE_HCA_VERSION,
  USER_SALT,
} from './manifest'
import type { Call } from './registration-calls'

/** Standalone fields supplied by the ENS patch but absent from SDK 1.8 types. */
export type StandaloneHcaAccount = Extract<
  AccountProviderConfig,
  { type: 'hca' }
> & {
  readonly version: typeof STANDALONE_HCA_VERSION
  readonly factory: Address
  readonly implementation: Address
  readonly validator: Address
  readonly verifiableFactory: Address
  readonly proxyLogic: Address
  readonly userSalt: bigint
}

/** Minimal reads against the deployed standalone HCA and its factories. */
const standaloneHcaAbi = parseAbi([
  'function owner() view returns (address)',
  'function accountId() view returns (string)',
])
const standaloneHcaFactoryAbi = parseAbi([
  'function authorizedOwnerOf(address hca) view returns (address)',
  'function deploy(address owner, address hcaImplementation, uint256 userSalt) returns (address hca)',
])
const verifiableFactoryAbi = parseAbi([
  'function verifyContract(address proxy) view returns (address implementation)',
])

export type RhinestoneInitError = AccountInitError | AccountVerificationError

export interface RhinestoneInitConfig {
  readonly chain: Chain
  readonly rhinestoneApiKey: string
}

export interface RhinestoneInitResult {
  /** The live SDK account object. */
  readonly client: RhinestoneAccount
  /** Deterministic HCA address. */
  readonly address: Address
  /** The connected wallet (single ECDSA owner) address. */
  readonly ownerAddress: Address
  /** Whether the HCA already had code on-chain at init time. */
  readonly alreadyDeployed: boolean
  readonly config: RhinestoneInitConfig
  /**
   * Re-read deployment state and rebuild the SDK client. Call after submitting
   * a direct factory deployment so the refreshed client is bound with
   * `initData: { address }` and cannot emit a second deploy operation.
   */
  readonly refresh: () => ResultAsync<RhinestoneInitResult, RhinestoneInitError>
}

export interface InitializeRhinestoneAccountParams {
  /** Pre-built viem `Account` used as the single ECDSA HCA owner. */
  readonly ownerAccount: Account
  /** EOA address that owns the HCA (usually `ownerAccount.address`). */
  readonly eoaAddress: Address
  /** Registration chain the HCA lives on (Sepolia). */
  readonly chain: Chain
  /** Public client for on-chain adopt-existing verification reads. */
  readonly publicClient: PublicClient
  /** Rhinestone API key. Required. */
  readonly rhinestoneApiKey: string
  /** Override the Rhinestone orchestrator endpoint (e.g. local `/orchestrator`). */
  readonly rhinestoneEndpointUrl?: string
  /** Per-chain RPC overrides for the SDK. */
  readonly rhinestoneCustomRpcUrls?: Record<number, string>
  /**
   * @deprecated The remediated reverse adapter delegates authorization to
   * `StandaloneHCAFactory.authorizedOwnerOf`; existing HCAs are now always
   * factory-certified during initialization. Retained for source compatibility.
   */
  readonly requireTrustedForPrimary?: boolean
}

/** Build the standalone-HCA account config block from the chain's manifest. */
export function buildStandaloneAccountConfig(
  chainId: number,
): StandaloneHcaAccount {
  const c = getDestinationContracts(chainId)
  return {
    type: 'hca',
    version: STANDALONE_HCA_VERSION,
    factory: c.standaloneHcaFactory,
    implementation: c.standaloneHcaImplementation,
    validator: c.hcaOwnerAndSessionValidator,
    verifiableFactory: c.verifiableFactory,
    proxyLogic: c.verifiableFactoryProxyLogic,
    userSalt: USER_SALT,
  }
}

/** A direct owner call can execute immediately, or needs the HCA deployed first. */
export type HcaDirectExecutionReadiness =
  | {
      readonly status: 'ready'
      readonly hca: Address
    }
  | {
      readonly status: 'deployment-required'
      readonly hca: Address
      readonly deploymentCall: Call
    }

export type BuildHcaDeploymentCallParams = {
  readonly client: Pick<RhinestoneAccount, 'getAddress' | 'getInitData'>
  readonly chainId: number
  readonly expectedHca: Address
  readonly expectedOwner: Address
}

export class HcaDeploymentCallValidationError extends Error {
  readonly field:
    | 'factory'
    | 'calldata'
    | 'clientHca'
    | 'derivedHca'
    | 'owner'
    | 'implementation'
    | 'userSalt'

  constructor(params: {
    readonly field: HcaDeploymentCallValidationError['field']
    readonly expected: string
    readonly actual: string
  }) {
    super(
      `HCA deployment ${params.field} mismatch (expected ${params.expected}, received ${params.actual})`,
    )
    this.name = 'HcaDeploymentCallValidationError'
    this.field = params.field
  }
}

export const computeStandaloneHcaAddress = (params: {
  readonly chainId: number
  readonly owner: Address
  readonly userSalt?: bigint
}): Address => {
  const contracts = getDestinationContracts(params.chainId)
  const userSalt = params.userSalt ?? USER_SALT
  const deploymentSalt = BigInt(
    keccak256(
      encodeAbiParameters(
        [
          { name: 'userSalt', type: 'uint256' },
          { name: 'owner', type: 'address' },
          { name: 'implementation', type: 'address' },
        ],
        [userSalt, params.owner, contracts.standaloneHcaImplementation],
      ),
    ),
  )
  return computeVerifiableProxyAddress({
    factory: contracts.verifiableFactory,
    proxyLogic: contracts.verifiableFactoryProxyLogic,
    deployer: contracts.standaloneHcaFactory,
    salt: deploymentSalt,
  })
}

/**
 * Build the standalone factory call exposed by the SDK for direct deployment.
 * This is useful before an EOA submits `executeByOwner(...)` directly, where
 * there is no Rhinestone intent setup phase to deploy the counterfactual HCA.
 */
export function buildHcaDeploymentCall(
  params: BuildHcaDeploymentCallParams,
): Call {
  const contracts = getDestinationContracts(params.chainId)
  const { factory, factoryData } = params.client.getInitData()
  if (!isAddressEqual(factory, contracts.standaloneHcaFactory)) {
    throw new HcaDeploymentCallValidationError({
      field: 'factory',
      expected: contracts.standaloneHcaFactory,
      actual: factory,
    })
  }

  const clientHca = params.client.getAddress()
  if (!isAddressEqual(clientHca, params.expectedHca)) {
    throw new HcaDeploymentCallValidationError({
      field: 'clientHca',
      expected: params.expectedHca,
      actual: clientHca,
    })
  }

  let decoded: ReturnType<
    typeof decodeFunctionData<typeof standaloneHcaFactoryAbi>
  >
  try {
    decoded = decodeFunctionData({
      abi: standaloneHcaFactoryAbi,
      data: factoryData,
    })
  } catch {
    throw new HcaDeploymentCallValidationError({
      field: 'calldata',
      expected: 'StandaloneHCAFactory.deploy(owner, implementation, userSalt)',
      actual: factoryData,
    })
  }
  if (decoded.functionName !== 'deploy') {
    throw new HcaDeploymentCallValidationError({
      field: 'calldata',
      expected: 'StandaloneHCAFactory.deploy(owner, implementation, userSalt)',
      actual: decoded.functionName,
    })
  }

  const [owner, implementation, userSalt] = decoded.args as readonly [
    Address,
    Address,
    bigint,
  ]
  if (!isAddressEqual(owner, params.expectedOwner)) {
    throw new HcaDeploymentCallValidationError({
      field: 'owner',
      expected: params.expectedOwner,
      actual: owner,
    })
  }
  if (!isAddressEqual(implementation, contracts.standaloneHcaImplementation)) {
    throw new HcaDeploymentCallValidationError({
      field: 'implementation',
      expected: contracts.standaloneHcaImplementation,
      actual: implementation,
    })
  }
  if (userSalt !== USER_SALT) {
    throw new HcaDeploymentCallValidationError({
      field: 'userSalt',
      expected: USER_SALT.toString(),
      actual: userSalt.toString(),
    })
  }

  const expectedFactoryData = encodeFunctionData({
    abi: standaloneHcaFactoryAbi,
    functionName: 'deploy',
    args: [
      params.expectedOwner,
      contracts.standaloneHcaImplementation,
      USER_SALT,
    ],
  })
  if (factoryData.toLowerCase() !== expectedFactoryData.toLowerCase()) {
    throw new HcaDeploymentCallValidationError({
      field: 'calldata',
      expected: expectedFactoryData,
      actual: factoryData,
    })
  }

  const derivedHca = computeStandaloneHcaAddress({
    chainId: params.chainId,
    owner,
    userSalt,
  })
  if (!isAddressEqual(derivedHca, params.expectedHca)) {
    throw new HcaDeploymentCallValidationError({
      field: 'derivedHca',
      expected: params.expectedHca,
      actual: derivedHca,
    })
  }

  return { to: factory, value: 0n, data: factoryData }
}

/**
 * Describe whether a freshly initialized account is ready for direct owner
 * execution. After sending `deploymentCall`, await its receipt and call the
 * init result's `refresh()` before using its SDK client again.
 */
export function getHcaDirectExecutionReadiness(
  account: Pick<
    RhinestoneInitResult,
    'client' | 'address' | 'ownerAddress' | 'alreadyDeployed' | 'config'
  >,
): HcaDirectExecutionReadiness {
  if (account.alreadyDeployed) {
    return { status: 'ready', hca: account.address }
  }
  return {
    status: 'deployment-required',
    hca: account.address,
    deploymentCall: buildHcaDeploymentCall({
      client: account.client,
      chainId: account.config.chain.id,
      expectedHca: account.address,
      expectedOwner: account.ownerAddress,
    }),
  }
}

function makeSdk(params: {
  chain: Chain
  rhinestoneApiKey: string
  rhinestoneEndpointUrl?: string
  rhinestoneCustomRpcUrls?: Record<number, string>
}): RhinestoneSDK {
  const defaultRpcUrl = params.chain.rpcUrls.default.http[0]
  const urls: Record<number, string> = {
    ...(defaultRpcUrl ? { [params.chain.id]: defaultRpcUrl } : {}),
    ...(params.rhinestoneCustomRpcUrls ?? {}),
  }
  return new RhinestoneSDK({
    auth: { mode: 'apiKey', apiKey: params.rhinestoneApiKey },
    provider: { type: 'custom', urls },
    ...(params.rhinestoneEndpointUrl
      ? { endpointUrl: params.rhinestoneEndpointUrl }
      : {}),
  })
}

/**
 * Verify an already-deployed HCA matches what we expect before adopting it.
 * Returns the verified current implementation. Throws `AccountVerificationError`
 * (never silently adopts a mismatched account).
 */
export interface VerifyStandaloneHcaParams {
  readonly publicClient: PublicClient
  readonly hca: Address
  readonly expectedOwner: Address
  readonly chainId: number
}

export async function verifyStandaloneHca(
  params: VerifyStandaloneHcaParams,
): Promise<Address> {
  const { publicClient, hca, expectedOwner, chainId } = params
  const c = getDestinationContracts(chainId)

  const [actualOwner, accountId, authorizedOwner, implementation] =
    await Promise.all([
      publicClient.readContract({
        address: hca,
        abi: standaloneHcaAbi,
        functionName: 'owner',
      }),
      publicClient.readContract({
        address: hca,
        abi: standaloneHcaAbi,
        functionName: 'accountId',
      }),
      publicClient.readContract({
        address: c.standaloneHcaFactory,
        abi: standaloneHcaFactoryAbi,
        functionName: 'authorizedOwnerOf',
        args: [hca],
      }),
      publicClient.readContract({
        address: c.verifiableFactory,
        abi: verifiableFactoryAbi,
        functionName: 'verifyContract',
        args: [hca],
      }),
    ])

  if (getAddress(actualOwner) !== getAddress(expectedOwner)) {
    throw new AccountVerificationError({
      message: 'Existing HCA owner does not match the connected wallet',
      field: 'owner',
      expected: getAddress(expectedOwner),
      actual: getAddress(actualOwner),
    })
  }

  if (getAddress(authorizedOwner) !== getAddress(expectedOwner)) {
    throw new AccountVerificationError({
      message:
        'Existing HCA factory authorization does not match the connected wallet',
      field: 'authorizedOwner',
      expected: getAddress(expectedOwner),
      actual: getAddress(authorizedOwner),
    })
  }

  if (accountId !== ONCHAIN_ACCOUNT_ID) {
    throw new AccountVerificationError({
      message: 'Existing HCA accountId does not match the standalone HCA',
      field: 'accountId',
      expected: ONCHAIN_ACCOUNT_ID,
      actual: accountId,
    })
  }

  // At launch the implementation must equal the configured initial
  // implementation. (Post-upgrade, this expands to any DAO-approved
  // implementation — tracked separately once upgrades exist.)
  if (
    getAddress(implementation) !== getAddress(c.standaloneHcaImplementation)
  ) {
    throw new AccountVerificationError({
      message: 'Existing HCA implementation is not the expected implementation',
      field: 'implementation',
      expected: getAddress(c.standaloneHcaImplementation),
      actual: getAddress(implementation),
    })
  }

  return implementation
}

/**
 * Initialize the standalone HCA in-memory, adopting an existing on-chain HCA
 * when the derived address already has code.
 *
 * Does NOT deploy — the first Rhinestone request performs the lazy deploy.
 */
export function initializeRhinestoneAccount(
  params: InitializeRhinestoneAccountParams,
): ResultAsync<RhinestoneInitResult, RhinestoneInitError> {
  if (!params.rhinestoneApiKey) {
    return errAsync(
      new AccountInitError({ message: 'rhinestoneApiKey is required' }),
    )
  }

  return fromPromise(
    (async () => {
      const sdk = makeSdk(params)
      const accountConfig = {
        account: buildStandaloneAccountConfig(params.chain.id),
        owners: {
          type: 'ecdsa' as const,
          accounts: [params.ownerAccount],
          module: getDestinationContracts(params.chain.id)
            .hcaOwnerAndSessionValidator,
        },
        experimental_sessions: {
          enabled: true,
          module: getDestinationContracts(params.chain.id)
            .hcaOwnerAndSessionValidator,
        },
      }

      // Derive the deterministic address with a no-initData config.
      const candidate = await sdk.createAccount(accountConfig)
      const hca = candidate.getAddress() as Address

      const code = await params.publicClient.getCode({ address: hca })
      const alreadyDeployed = Boolean(code && code !== '0x')

      // Bind the account to its deploy state.
      //
      // The SDK's setup-ops (which include the factory deploy call) are gated by
      // `initData`: when `initData: { address }` is set, `getInitCode` returns
      // the address-only form → `getSetupOperationsAndDelegations` returns
      // `setupOps: []` (no deploy). When `initData` is absent, the deploy op is
      // included.
      //
      // Therefore:
      //   - UNDEPLOYED HCA → NO initData, so the first (commit) action's
      //     setup-ops deploy it.
      //   - ALREADY-DEPLOYED HCA → initData: { address }, so no re-deploy op is
      //     emitted (a re-deploy makes the intent's session signature invalid →
      //     `InvalidSignature()`). This also covers the "existing HCA, new
      //     session" case: the enable call runs, but the account is not
      //     re-deployed.
      //
      // NOTE: this is evaluated per `initializeRhinestoneAccount` call. Once the
      // commit deploys a previously-undeployed HCA, the caller must re-init so
      // the reveal (and future registrations) use the deployed (initData)
      // binding — see the manager's re-init on the smart-account machine.
      if (alreadyDeployed) {
        await verifyStandaloneHca({
          publicClient: params.publicClient,
          hca,
          expectedOwner: params.eoaAddress,
          chainId: params.chain.id,
        })
      }

      const client = alreadyDeployed
        ? await sdk.createAccount({
            ...accountConfig,
            initData: { address: hca },
          })
        : candidate

      return {
        client,
        address: hca,
        ownerAddress: params.eoaAddress,
        alreadyDeployed,
        config: {
          chain: params.chain,
          rhinestoneApiKey: params.rhinestoneApiKey,
        },
        refresh: () => initializeRhinestoneAccount(params),
      }
    })(),
    (error: unknown) => {
      if (error instanceof AccountVerificationError) return error
      return new AccountInitError({
        message: 'Failed to initialize standalone HCA account',
        cause: error,
      })
    },
  )
}
