import type { NameRowProfilePreview } from '@/features/dashboard/components/nameRowProfileRecords'

/** A selected name eligible for bulk renewal (v2 2LD `.eth` only). */
export type BulkRenewName = {
  /** Bare label without `.eth`, used for the on-chain price read. */
  readonly label: string
  /** Full name (e.g. `erni.eth`) used for profile record lookups. */
  readonly name: string
  /** Label shown in the UI. */
  readonly displayName: string
  /** Current on-chain expiry in seconds. */
  readonly currentExpiry: bigint
}

/**
 * How much to renew by: either a fixed number of years applied to every name,
 * or a shared target date every name is renewed to.
 */
export type Selection =
  | { readonly kind: 'preset'; readonly years: number }
  | { readonly kind: 'custom'; readonly targetMs: number }

/** One row of the per-name renewal summary. */
export type SummaryRow = {
  readonly key: string
  readonly displayName: string
  readonly label: string
  readonly preview: NameRowProfilePreview
  /** USD subtotal, or `undefined` while the price is loading. */
  readonly subtotal: number | undefined
  readonly startDate: Date
  readonly endDate: Date
}

/** Aggregate totals for one duration preset across all selected names. */
export type PresetSummary = {
  readonly total: number
  readonly discountAmount: number
  readonly discountPercentage: number
}

/** Everything needed to submit one name's renewal on-chain. */
export type RenewItem = {
  readonly label: string
  readonly duration: bigint
}

/** Per-name status while the atomic batch renewal runs. */
export type RowStatus = 'pending' | 'active' | 'done' | 'error'

/** Overall progress of the bulk-renewal submission. */
export type BulkRenewPhase =
  | 'idle'
  | 'preparing'
  | 'authorizing'
  | 'renewing'
  | 'success'
  | 'error'
