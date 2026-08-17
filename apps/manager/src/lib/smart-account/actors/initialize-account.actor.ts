import type { SmartAccountConfig } from '@ens-apps/transaction-manager'
import { TaggedError } from '@ens-apps/utils/neverthrow'
import type { RhinestoneAccount } from '@rhinestone/sdk'
import type {
  AccountError,
  ExecutionError,
  OrchestratorError,
} from '@rhinestone/sdk/errors'
import { errAsync, fromPromise, type ResultAsync } from 'neverthrow'
import type { Address, PublicClient, WalletClient } from 'viem'
import {
  initializeRhinestoneAccount,
  type RhinestoneInitResult,
} from '../rhinestone'
import type { WalletSource as BaseWalletSource } from '../types'

type WalletSource = Exclude<BaseWalletSource, null>

// Provider-specific error cause types. Internal to this module — the
// machine only consumes the `Error` produced by `AccountInitializationError`
// and never narrows on `provider`, so these don't need to be exported.
type RhinestoneErrorCause = AccountError | ExecutionError | OrchestratorError

type RoutingErrorCause = Error

type AccountInitializationErrorCause = RhinestoneErrorCause | RoutingErrorCause

export type AccountClient = RhinestoneAccount
export interface AccountInitResult {
  readonly client: AccountClient
  readonly address: Address
  readonly ownerAddress: Address
  readonly config: SmartAccountConfig
}

interface InitializeAccountInput {
  readonly walletSource: WalletSource
  readonly walletClient?: WalletClient
  readonly publicClient?: PublicClient
}

class AccountInitializationError extends TaggedError(
  'AccountInitializationError',
)<{
  message: string
  provider: 'rhinestone' | 'routing'
  cause: AccountInitializationErrorCause
}> {}

function mapRhinestoneConfig(
  result: RhinestoneInitResult,
  ownerAddress: Address,
): AccountInitResult {
  const smartConfig: SmartAccountConfig = {
    chain: result.config.chain,
    accountAddress: result.address,
    rhinestoneApiKey: result.config.rhinestoneApiKey,
  }

  return {
    client: result.client,
    address: result.address,
    ownerAddress,
    config: smartConfig,
  }
}

/**
 * Initialize smart account.
 *
 * Rhinestone is the only smart-account provider used by the manager app;
 * the connected external wallet is the account owner. The account is
 * always deployed in HCA (Hybrid Custodial Account) mode.
 */
export function initializeAccountActor(
  input: InitializeAccountInput,
): ResultAsync<AccountInitResult, AccountInitializationError> {
  const { walletClient, publicClient } = input

  if (!walletClient) {
    return errAsync(
      new AccountInitializationError({
        message: 'Missing wallet client for Rhinestone initialization',
        provider: 'routing',
        cause: new Error('Missing wallet client for Rhinestone initialization'),
      }),
    )
  }
  if (!publicClient) {
    return errAsync(
      new AccountInitializationError({
        message: 'Missing public client for Rhinestone initialization',
        provider: 'routing',
        cause: new Error('Missing public client for Rhinestone initialization'),
      }),
    )
  }

  return fromPromise(
    initializeRhinestoneAccount({
      walletClient,
      publicClient,
    }),
    (error) => {
      const cause = error as RhinestoneErrorCause
      return new AccountInitializationError({
        message:
          cause instanceof Error && cause.message
            ? cause.message
            : 'Failed to initialize Rhinestone account',
        provider: 'rhinestone',
        cause,
      })
    },
  ).map((result) => mapRhinestoneConfig(result, result.ownerAddress))
}
