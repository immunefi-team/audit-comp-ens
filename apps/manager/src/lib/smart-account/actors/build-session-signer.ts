/**
 * Build the `RhinestoneSessionContext` to attach to a `RhinestoneSigner` from
 * a stored standalone-HCA session.
 *
 * The scoped SmartSession is reconstructed (no wallet prompt) from the
 * persisted scalar fields via `rebuildDestinationSession` — the salt is
 * recomputed so the on-chain `permissionId` matches, and the ephemeral session
 * key is re-derived from its private key. The warp transport then signs Intents
 * with `signers: { type: 'experimental_session', session, ... }`.
 */

import {
  type RhinestoneStoredSession,
  rebuildDestinationSession,
} from '@ens-apps/smart-account'
import type { RhinestoneSessionContext } from '@ens-apps/transaction-manager'
import type { Address, Chain } from 'viem'

export function buildSessionContext(params: {
  readonly session: RhinestoneStoredSession
  readonly chain: Chain
  readonly hca: Address
}): RhinestoneSessionContext {
  const { session } = rebuildDestinationSession({
    chain: params.chain,
    hca: params.hca,
    resolver: params.session.resolver,
    hcaSessionNonce: BigInt(params.session.hcaSessionNonce),
    validUntil: BigInt(params.session.validUntil),
    sessionPrivateKey: params.session.sessionPrivateKey,
  })
  return { session }
}
