import {
  parseTransactionOperation,
  type UpsertTransaction,
} from '@ens-apps/shared-schema/transactions'
import {
  type ArchivedTransaction,
  getPrimaryCall,
} from '@ens-apps/transaction-manager'
import { logger } from '@ens-apps/utils/logger'
import { backendClient, isBackendAuthed } from '@/utils/backend-client'

/**
 * Map an archived transaction to the backend report body.
 *
 * The body shape and the supported operation set come from the shared
 * `UpsertTransactionSchema`, so the app and the api-worker validate against a
 * single source. The core transaction-manager types `operation` loosely as
 * `string`, so we narrow it to the contract at this app/backend boundary.
 *
 * Returns `null` when the transaction can't be reported (no chainId), so
 * callers can skip it. Pure — no I/O — so it's unit-testable.
 */
export function buildTransactionReport(
  archived: ArchivedTransaction,
): UpsertTransaction | null {
  if (archived.chainId === undefined) return null

  const payload: Record<string, unknown> = {}
  if (archived.error) payload.error = archived.error
  const primaryCall = archived.request
    ? getPrimaryCall(archived.request)
    : undefined
  if (primaryCall?.to) payload.to = primaryCall.to
  if (primaryCall?.value !== undefined) {
    payload.value = primaryCall.value.toString()
  }

  return {
    txId: archived.txId,
    chainId: archived.chainId,
    hash: archived.hash ?? null,
    status: archived.status,
    operation: parseTransactionOperation(archived.operation) ?? null,
    name: archived.name ?? null,
    payload: Object.keys(payload).length > 0 ? payload : null,
  }
}

/**
 * Report a terminal transaction to the user's account in the notification
 * service. No-op when the user is not authenticated with the backend.
 */
export async function reportArchivedTransaction(
  archived: ArchivedTransaction,
): Promise<void> {
  if (!isBackendAuthed.get()) return

  const body = buildTransactionReport(archived)
  if (!body) return

  try {
    const response = await backendClient.transactions.$post({ json: body })
    if (!response.ok) {
      logger.warn('Failed to report transaction history', {
        txId: body.txId,
        status: response.status,
      })
    }
  } catch (error) {
    logger.warn('Failed to report transaction history', {
      txId: body.txId,
      error,
    })
  }
}
