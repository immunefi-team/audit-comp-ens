import type { ArchivedTransaction } from '@ens-apps/transaction-manager'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { listeners, unsubscribe, reportSpy } = vi.hoisted(() => ({
  listeners: [] as Array<(archived: ArchivedTransaction) => void>,
  unsubscribe: vi.fn(),
  reportSpy: vi.fn(),
}))

vi.mock('@ens-apps/transaction-manager', () => ({
  transactionManager: {
    onTransactionArchived: vi.fn(
      (listener: (a: ArchivedTransaction) => void) => {
        listeners.push(listener)
        return unsubscribe
      },
    ),
  },
}))

vi.mock('./report', () => ({
  reportArchivedTransaction: reportSpy,
}))

import { transactionManager } from '@ens-apps/transaction-manager'
import { TransactionHistoryReporter } from './TransactionHistoryReporter'

const archived: ArchivedTransaction = {
  txId: 'tx-1',
  chainId: 11155111,
  status: 'success',
  timestamp: 1_700_000_000_000,
}

beforeEach(() => {
  // Reset before each test so the prior test's testing-library auto-cleanup
  // (which unmounts and calls unsubscribe) doesn't bleed call counts forward.
  listeners.length = 0
  vi.clearAllMocks()
})

describe('TransactionHistoryReporter', () => {
  it('subscribes on mount and forwards archived transactions to the reporter', () => {
    render(<TransactionHistoryReporter />)

    expect(transactionManager.onTransactionArchived).toHaveBeenCalledTimes(1)
    expect(listeners).toHaveLength(1)

    listeners[0]?.(archived)
    expect(reportSpy).toHaveBeenCalledWith(archived)
  })

  it('unsubscribes on unmount', () => {
    const { unmount } = render(<TransactionHistoryReporter />)
    expect(unsubscribe).not.toHaveBeenCalled()

    unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
