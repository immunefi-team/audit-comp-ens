# Success State

## Overview

The `success` state is the final state for a successful transaction. The transaction has been mined, confirmed, and executed successfully on the blockchain. This is a terminal state in the happy path flow.

## When Machine Enters This State

- After successful confirmation (`confirming` → `success`)
- The transaction receipt shows `status === 'success'`
- All state changes have been applied on-chain

## What Happens in This State

### Entry Actions
```typescript
success: {
  entry: [
    'recordTransition',  // Log to audit trail
    ({ context }) => {
      // Log success details
      auditTrail.addAuditEntry(
        'info',
        'Transaction completed successfully',
        {
          hash: context.hash,
          receipt: context.receipt,
          gasUsed: context.receipt?.gasUsed?.toString()
        }
      )
    }
  ]
}
```

### Accepted Events

The machine can handle additional events in success state:

```typescript
on: {
  EXECUTE: {
    // Can start another transaction
    target: 'preparing',
    actions: assign({
      request: ({ event }) => event.request,
      options: ({ event }) => event.options || {},
      retryCount: 0,
      fallbackChecks: 0,
      hash: undefined,
      userOpHash: undefined,
      receipt: undefined,
      error: undefined
    })
  }
}
```

This allows the same machine instance to process multiple sequential transactions.

## Context in This State

```typescript
{
  publicClient: PublicClient,
  intent: TransactionIntent,    // Original intent
  request: TransactionRequest,  // Prepared request
  signer: Signer,               // Signer used
  chainId: number,
  useSmartAccount: boolean,
  hash: Hash,                   // ✅ Transaction hash
  receipt: TransactionReceipt,  // ✅ Success receipt
  error: undefined,             // No errors
  retryCount: number,           // How many retries occurred
  fallbackChecks: number,       // If fallback was used
  estimatedCost: bigint,        // Original estimate
  options: TransactionOptions,  // Modal, description, etc.
}
```

## What Success Means

When a transaction reaches success state:

1. ✅ **Transaction was mined** - Included in a block
2. ✅ **Transaction was confirmed** - Waited for specified confirmations
3. ✅ **Execution succeeded** - `receipt.status === 'success'`
4. ✅ **State changes applied** - Contract state updated on-chain
5. ✅ **Events emitted** - Logs are available in receipt
6. ✅ **Gas consumed** - User paid for the transaction

## User Experience

**What the user sees:**
- Success message with checkmark icon
- Transaction hash (link to block explorer)
- Gas used information
- Option to perform another transaction
- Success state persists (doesn't disappear immediately)

**What the user can do:**
- View transaction on block explorer
- See event logs and state changes
- Start another transaction
- Close the modal/notification

**UI Recommendations:**
```typescript
const txState = useSelector(txActor, (s) => s?.value)
const txHash = useSelector(txActor, (s) => s?.context.hash)
const txReceipt = useSelector(txActor, (s) => s?.context.receipt)

{match(txState)
  .with('success', () => (
    <div className="bg-green-50 border border-green-200 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircleIcon className="w-8 h-8 text-green-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-green-900">
            Transaction Successful!
          </h3>
          <p className="text-sm text-green-700">
            Your transaction has been confirmed on the blockchain
          </p>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Transaction Hash:</span>
          <a
            href={`https://sepolia.etherscan.io/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline font-mono text-xs"
          >
            {txHash?.slice(0, 10)}...{txHash?.slice(-8)}
          </a>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-600">Block Number:</span>
          <span className="font-mono text-xs">
            {txReceipt?.blockNumber.toString()}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-600">Gas Used:</span>
          <span className="font-mono text-xs">
            {txReceipt?.gasUsed.toString()}
          </span>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={() => window.open(`https://sepolia.etherscan.io/tx/${txHash}`, '_blank')}
          className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          View on Explorer
        </button>
        <button
          onClick={handleRenewAgain}
          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          Renew Again
        </button>
      </div>
    </div>
  ))
  // ...
}
```

## Receipt Information Available

In success state, you can access detailed information from the receipt:

```typescript
const txReceipt = useSelector(txActor, (s) => s?.context.receipt)

// Transaction details
console.log('Hash:', txReceipt.transactionHash)
console.log('Block:', txReceipt.blockNumber)
console.log('Gas Used:', txReceipt.gasUsed)
console.log('Effective Gas Price:', txReceipt.effectiveGasPrice)

// Calculate total cost
const totalCost = txReceipt.gasUsed * txReceipt.effectiveGasPrice
console.log('Total Gas Cost:', formatEther(totalCost), 'ETH')

// Event logs (if any)
console.log('Events:', txReceipt.logs)

// Example: Parse ENS renewal event
const renewalEvent = txReceipt.logs.find(
  log => log.topics[0] === keccak256('NameRenewed(string,uint256)')
)
if (renewalEvent) {
  console.log('Renewal confirmed in event logs')
}
```

## Audit Trail Entry

When entering success state, a detailed audit entry is created:

```typescript
{
  severity: 'info',
  message: 'Transaction completed successfully',
  data: {
    hash: '0x123...',
    receipt: {
      status: 'success',
      blockNumber: 12345n,
      gasUsed: 150000n,
      // ... full receipt
    },
    gasUsed: '150000'
  },
  timestamp: Date.now()
}
```

This can be retrieved for debugging:

```typescript
import { getTransitionHistory, generateDebugReport } from '@ens-apps/transaction-manager'

// Get all transitions
const history = getTransitionHistory('transaction')

// Generate report
const report = generateDebugReport()
console.log(report)
```

## Starting Another Transaction

The success state allows starting a new transaction:

```typescript
// Machine is in success state
const currentState = actor.getSnapshot().value  // 'success'

// Send EXECUTE event with new transaction
actor.send({
  type: 'EXECUTE',
  request: newRequest,
  signer: newSigner,
  options: newOptions
})

// Machine transitions: success → preparing
// Context is reset for the new transaction
```

This is useful for:
- "Renew Again" buttons
- Sequential transactions (approve → transfer)
- Batch operations

## Code Location

**File**: `packages/transaction-manager/src/machines/transaction.machine.ts`

```typescript
success: {
  entry: [
    'recordTransition',
    ({ context }) => {
      auditTrail.addAuditEntry(
        'info',
        'Transaction completed successfully',
        {
          hash: context.hash,
          receipt: context.receipt,
          gasUsed: context.receipt?.gasUsed?.toString()
        }
      )
    }
  ],
  on: {
    EXECUTE: {
      target: 'preparing',
      actions: assign({
        request: ({ event }) => event.request,
        options: ({ event }) => event.options || {},
        retryCount: 0,
        fallbackChecks: 0,
        hash: undefined,
        userOpHash: undefined,
        receipt: undefined,
        error: undefined
      })
    }
  }
}
```

## Testing This State

```typescript
import { createActor } from 'xstate'
import { transactionMachine } from '@ens-apps/transaction-manager'

test('success state has complete transaction data', () => {
  const mockReceipt = {
    status: 'success',
    transactionHash: '0xhash123',
    blockNumber: 12345n,
    gasUsed: 150000n,
    effectiveGasPrice: 20000000000n,
    logs: [],
  }

  const actor = createActor(transactionMachine, {
    input: {
      hash: '0xhash123',
      receipt: mockReceipt,
      intent: mockIntent,
      request: mockRequest,
    }
  })

  actor.start()

  const snapshot = actor.getSnapshot()

  expect(snapshot.value).toBe('success')
  expect(snapshot.context.hash).toBe('0xhash123')
  expect(snapshot.context.receipt?.status).toBe('success')
  expect(snapshot.context.receipt?.gasUsed).toBe(150000n)
  expect(snapshot.context.error).toBeUndefined()
})

test('can start another transaction from success', () => {
  const actor = createActor(transactionMachine, { ... })
  actor.start()

  expect(actor.getSnapshot().value).toBe('success')

  // Send new transaction
  actor.send({
    type: 'EXECUTE',
    request: newMockRequest,
    signer: mockSigner,
    options: {}
  })

  expect(actor.getSnapshot().value).toBe('preparing')
  expect(actor.getSnapshot().context.hash).toBeUndefined()  // Reset
})
```

## Common Questions

### Q: Is success state terminal?

**A:** Yes and no:
- It's terminal for the current transaction (won't transition further)
- But it accepts EXECUTE events to start a new transaction
- The machine can be reused for sequential transactions

### Q: How long should I show the success state to the user?

**A:** Best practices:
- Show for at least 3-5 seconds (let user read it)
- Provide a "Close" button for manual dismissal
- For modals: Auto-close after 5-10 seconds (with countdown)
- For notifications: Persist until user dismisses
- For status panels: Keep visible with "View Transaction" link

### Q: Should I refetch data after success?

**A:** Usually yes! After a successful transaction:
- Refetch account balance (gas was consumed)
- Refetch contract state (e.g., new ENS expiry date)
- Invalidate related queries
- Update UI with new on-chain state

```typescript
import { useQueryClient } from '@tanstack/react-query'

const queryClient = useQueryClient()

useEffect(() => {
  if (txState === 'success') {
    // Refetch relevant queries
    queryClient.invalidateQueries({ queryKey: ['ensName', name] })
    queryClient.invalidateQueries({ queryKey: ['balance', address] })
  }
}, [txState])
```

### Q: What if I want to clean up old transaction actors?

**A:** Best practices:
- For single transactions: Keep actor until user dismisses UI
- For multiple transactions: Implement cleanup strategy in transactionManager
- Store transaction history in localStorage for reference
- Remove actors after X hours or Y completed transactions

## Common Patterns

### Pattern 1: Sequential Transactions
```typescript
// Transaction 1 completes
if (txState === 'success') {
  // Start transaction 2 automatically
  const newTxId = transactionManager.startTransaction(
    nextIntent,
    signer,
    options
  )
  setCurrentTxId(newTxId)
}
```

### Pattern 2: Success Callback
```typescript
useEffect(() => {
  if (txState === 'success' && onSuccess) {
    onSuccess({
      hash: txHash,
      receipt: txReceipt
    })
  }
}, [txState])
```

### Pattern 3: Celebration Animation
```typescript
{txState === 'success' && (
  <Confetti
    width={window.innerWidth}
    height={window.innerHeight}
    recycle={false}
    numberOfPieces={200}
  />
)}
```

## Related States

- **Previous State**: [confirming](./CONFIRMING.md) - Verification
- **Next State**: [preparing](./PREPARING.md) - If starting another transaction
- **Alternative**: [error.reverted](./ERROR_STATES.md#reverted-error) - If transaction failed

## Related Documentation

- [TRANSACTION_FLOW.md](../TRANSACTION_FLOW.md) - Complete transaction lifecycle
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System overview
