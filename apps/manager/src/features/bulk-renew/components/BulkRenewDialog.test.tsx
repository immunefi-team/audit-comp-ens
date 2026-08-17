import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@/utils/test-utils'
import type { SummaryRow } from '../types'
import { BulkRenewDialog } from './BulkRenewDialog'

// Control the two data hooks so we can swap what `useBulkRenew` returns AFTER
// confirming — simulating the post-renewal dashboard refetch that rewrites each
// name's expiry — and flip the submit phase to `success`.
const hooks = vi.hoisted(() => ({
  useBulkRenew: vi.fn(),
  useBulkRenewSubmit: vi.fn(),
}))
vi.mock('../hooks/useBulkRenew', () => ({ useBulkRenew: hooks.useBulkRenew }))
vi.mock('../hooks/useBulkRenewSubmit', () => ({
  useBulkRenewSubmit: hooks.useBulkRenewSubmit,
}))

// Strip framer-motion so the crossfade doesn't hold the old view during exit.
vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: new Proxy(
    {},
    {
      get:
        () =>
        ({ children }: { children: React.ReactNode }) =>
          children,
    },
  ),
}))

// Light stubs for everything except SuccessStep, which echoes the dates it's
// handed so the assertion can read them.
vi.mock('./DurationPresets', () => ({ DurationPresets: () => <div /> }))
vi.mock('./RenewToDatePopover', () => ({ RenewToDatePopover: () => <div /> }))
vi.mock('./PaymentMethodSection', () => ({
  PaymentMethodSection: () => <div />,
}))
vi.mock('./NamesBreakdown', () => ({ NamesBreakdown: () => <div /> }))
vi.mock('./RenewingStep', () => ({ RenewingStep: () => <div /> }))
vi.mock('./FailureStep', () => ({ FailureStep: () => <div /> }))
vi.mock('./SuccessStep', () => ({
  SuccessStep: ({ rows }: { rows: readonly SummaryRow[] }) => (
    <div data-testid="success">
      {rows.map((row) => (
        <div data-testid="success-row" key={row.key}>
          {row.startDate.toISOString()} {row.endDate.toISOString()}
        </div>
      ))}
    </div>
  ),
}))

const makeRow = (startISO: string, endISO: string): SummaryRow => ({
  key: 'seph.eth',
  displayName: 'seph.eth',
  label: 'seph',
  preview: {} as SummaryRow['preview'],
  subtotal: 10,
  startDate: new Date(startISO),
  endDate: new Date(endISO),
})

const bulkRenewResult = (rows: readonly SummaryRow[]) => ({
  minSelectableDate: new Date('2040-07-01T00:00:00.000Z'),
  grandTotal: 10,
  sumPriceRaw: 0n,
  summaryRows: rows,
  renewItems: [{ label: 'seph', duration: 100n }],
  presetSummaries: [],
  payment: {
    isConnected: true,
    isLoadingBalances: false,
    stablecoinBalances: [],
    canConfirm: true,
  },
})

const submit = vi.fn()
const reset = vi.fn()
let submitPhase = 'idle'

beforeEach(() => {
  submit.mockClear()
  reset.mockClear()
  submitPhase = 'idle'
  hooks.useBulkRenewSubmit.mockImplementation(() => ({
    phase: submitPhase,
    statuses: {},
    errorMessage: undefined,
    submit,
    reset,
  }))
})

describe('BulkRenewDialog success receipt', () => {
  it('shows the confirm-time range on success, not the post-renewal recompute', () => {
    // At confirm time the name renews June 12 → July 20.
    hooks.useBulkRenew.mockImplementation(() =>
      bulkRenewResult([
        makeRow('2040-06-12T00:00:00.000Z', '2040-07-20T00:00:00.000Z'),
      ]),
    )

    const { rerender } = render(
      <BulkRenewDialog names={[]} onOpenChange={() => {}} open />,
    )

    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    expect(submit).toHaveBeenCalledOnce()

    // The renewal lands and the dashboard refetch rewrites the expiry to July 20,
    // so a live recompute would now read July 20 → August 17.
    hooks.useBulkRenew.mockImplementation(() =>
      bulkRenewResult([
        makeRow('2040-07-20T00:00:00.000Z', '2040-08-17T00:00:00.000Z'),
      ]),
    )
    submitPhase = 'success'
    rerender(<BulkRenewDialog names={[]} onOpenChange={() => {}} open />)

    const row = screen.getByTestId('success-row')
    // Frozen at confirm — the shifted range must NOT leak through.
    expect(row).toHaveTextContent('2040-06-12')
    expect(row).toHaveTextContent('2040-07-20')
    expect(row).not.toHaveTextContent('2040-08-17')
  })
})
