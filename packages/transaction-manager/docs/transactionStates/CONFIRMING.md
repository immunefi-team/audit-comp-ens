# Confirming State

## Overview

The `confirming` state is where the machine verifies whether the mined transaction succeeded or reverted. At this point, the transaction has been included in a block and we have a receipt, but we need to check the execution result.

## When Machine Enters This State

- After receiving a transaction receipt (`pending` → `confirming`)
- The transaction has been mined and confirmed
- We have a `TransactionReceipt` with status information

## What Happens in This State

### Entry Actions
```typescript
confirming: {
  entry: ['recordTransition']
  // Logs state transition to audit trail
}
```

### Verification Process

The machine immediately checks the receipt status using a guard:

```typescript
always: [
  {
    guard: 'isReverted',  // Check receipt.status === 'reverted'
    target: 'error.reverted',
    actions: [
      assign({
        error: ({ context }) => new TransactionRevertedError(
          context.hash!,
          context.receipt!
        )
      }),
      'logError',
      'recordTransition'
    ]
  },
  {
    target: 'success',  // ← Transaction succeeded!
    actions: 'recordTransition'
  }
]
```

## Timeline

```
Enter confirming state (have receipt)
       ↓
Check receipt.status
       ↓
    ┌─────┴─────┐
    ▼           ▼
'success'   'reverted'
    │           │
    ▼           ▼
success     error.reverted
  state        state
```

**Duration**: Instant (synchronous check)

## Context Before This State

```typescript
{
  publicClient: PublicClient,
  intent: TransactionIntent,
  request: TransactionRequest,
  signer: Signer,
  hash: Hash,
  receipt: TransactionReceipt,  // ✅ Have receipt
  error: undefined,
}
```

## Context After This State

### If Successful
```typescript
{
  // ... same as before
  // No changes - context stays the same
  // Machine transitions to 'success' state
}
```

### If Reverted
```typescript
{
  // ... same as before, plus:
  error: TransactionRevertedError,  // ✅ Revert error created
  // Machine transitions to 'error.reverted' state
}
```

## Transitions

### Success Path
```
confirming → receipt.status === 'success' → success
```

### Error Path
```
confirming → receipt.status === 'reverted' → error.reverted
```

## Transaction Receipt Status

A transaction receipt has one of two statuses:

```typescript
type TransactionStatus = 'success' | 'reverted'
```

### Success
The transaction executed successfully:
- All contract calls succeeded
- State changes were applied
- Events were emitted

### Reverted
The transaction failed during execution:
- A `require()` or `assert()` check failed
- Contract threw an error
- Out of gas during execution
- State changes were rolled back
- **Still consumed gas** (gas is not refunded for reverted transactions)

## Receipt Structure

```typescript
interface TransactionReceipt {
  status: 'success' | 'reverted'
  transactionHash: Hash
  blockNumber: bigint
  blockHash: Hash
  gasUsed: bigint              // Gas consumed (even if reverted!)
  effectiveGasPrice: bigint
  from: Address
  to: Address | null
  contractAddress: Address | null
  logs: Log[]                  // Events (empty if reverted)
  logsBloom: Hex
  cumulativeGasUsed: bigint
  type: 'legacy' | 'eip1559' | 'eip2930'
}
```

## User Experience

**What the user sees:**

### If Successful
- "Transaction confirmed!" message
- Success checkmark icon
- Transaction hash with block explorer link
- Gas used information

### If Reverted
- "Transaction failed" message
- Error icon
- Revert reason (if available)
- Gas still consumed (user paid for failed transaction)

**UI Recommendations:**
```typescript
const txState = useSelector(txActor, (s) => s?.value)
const txHash = useSelector(txActor, (s) => s?.context.hash)
const txReceipt = useSelector(txActor, (s) => s?.context.receipt)
const txError = useSelector(txActor, (s) => s?.context.error)

{match(txState)
  .with('success', () => (
    <div className="bg-green-50 border border-green-200 rounded p-4">
      <div className="flex items-center gap-2">
        <CheckIcon className="text-green-600" />
        <h3>Transaction Confirmed!</h3>
      </div>
      <p className="text-sm text-gray-600 mt-2">
        Gas used: {txReceipt?.gasUsed.toString()}
      </p>
      <a
        href={`https://sepolia.etherscan.io/tx/${txHash}`}
        target="_blank"
        className="text-blue-600 text-sm"
      >
        View on Etherscan ↗
      </a>
    </div>
  ))
  .with({ error: { reverted: P.select() } }, () => (
    <div className="bg-red-50 border border-red-200 rounded p-4">
      <div className="flex items-center gap-2">
        <ErrorIcon className="text-red-600" />
        <h3>Transaction Failed</h3>
      </div>
      <p className="text-sm text-gray-600 mt-2">
        {txError?.message || 'Transaction reverted'}
      </p>
      <p className="text-xs text-gray-500 mt-1">
        Gas was still consumed: {txReceipt?.gasUsed.toString()}
      </p>
    </div>
  ))
  // ...
}
```

## Guard Implementation

**File**: `packages/transaction-manager/src/machines/transaction.machine.ts`

```typescript
guards: {
  isReverted: ({ context }) =>
    context.receipt?.status === 'reverted'
}
```

This guard checks if the receipt indicates the transaction reverted.

## Common Revert Reasons

### Require Statement Failed
```solidity
require(msg.value >= price, "Insufficient payment");
// If condition false, transaction reverts with message
```

Receipt may contain revert reason in some cases.

### Out of Gas
```typescript
// Gas limit too low for operation
{
  gas: 21000n  // Not enough for complex contract call
}
```

Transaction runs out of gas mid-execution and reverts.

### Assert Failed
```solidity
assert(balance >= amount);
// Critical invariant violated
```

Indicates a serious bug in contract logic.

### Custom Error
```solidity
error InsufficientFunds(uint256 requested, uint256 available);

if (balance < amount) {
  revert InsufficientFunds(amount, balance);
}
```

Modern Solidity uses custom errors for gas efficiency.

## TransactionRevertedError

When a transaction reverts, the machine creates a specific error:

```typescript
// src/errors/transaction.errors.ts
export class TransactionRevertedError extends Error {
  constructor(
    public hash: Hash,
    public receipt: TransactionReceipt
  ) {
    super(`Transaction ${hash} reverted`)
    this.name = 'TransactionRevertedError'
  }
}
```

This error contains:
- Transaction hash
- Full receipt (including gasUsed)
- Can be extended to include revert reason parsing

## Extracting Revert Reasons

Viem can sometimes extract revert reasons:

```typescript
try {
  const receipt = await publicClient.waitForTransactionReceipt({ hash })

  if (receipt.status === 'reverted') {
    // Try to get revert reason via eth_call simulation
    const tx = await publicClient.getTransaction({ hash })

    try {
      await publicClient.call({
        to: tx.to,
        data: tx.input,
        value: tx.value,
        from: tx.from,
      })
    } catch (error) {
      console.log('Revert reason:', error.message)
      // "Execution reverted: Insufficient payment"
    }
  }
} catch (error) {
  // Handle error
}
```

## Code Location

**File**: `packages/transaction-manager/src/machines/transaction.machine.ts`

```typescript
confirming: {
  entry: 'recordTransition',
  always: [
    {
      guard: 'isReverted',
      target: 'error.reverted',
      actions: [
        assign({
          error: ({ context }) => new TransactionRevertedError(
            context.hash!,
            context.receipt!
          )
        }),
        'logError',
        'recordTransition'
      ]
    },
    {
      target: 'success',
      actions: 'recordTransition'
    }
  ]
}
```

## Testing This State

```typescript
import { createActor } from 'xstate'
import { transactionMachine } from '@ens-apps/transaction-manager'

test('successful receipt transitions to success', () => {
  const actor = createActor(transactionMachine, {
    input: {
      hash: '0xhash123',
      receipt: {
        status: 'success',  // ← Success
        transactionHash: '0xhash123',
        blockNumber: 12345n,
        gasUsed: 21000n,
        // ... other fields
      }
    }
  })

  actor.start()

  expect(actor.getSnapshot().value).toBe('success')
  expect(actor.getSnapshot().context.error).toBeUndefined()
})

test('reverted receipt transitions to error', () => {
  const actor = createActor(transactionMachine, {
    input: {
      hash: '0xhash123',
      receipt: {
        status: 'reverted',  // ← Reverted
        transactionHash: '0xhash123',
        blockNumber: 12345n,
        gasUsed: 50000n,  // Still consumed gas!
        // ... other fields
      }
    }
  })

  actor.start()

  expect(actor.getSnapshot().value).toBe('error.reverted')
  expect(actor.getSnapshot().context.error?.name).toBe('TransactionRevertedError')
})
```

## Common Questions

### Q: Why have a separate confirming state? Can't we check status in pending?

**A:** Separation of concerns:
- **pending**: Waits for transaction to be mined (async operation)
- **confirming**: Verifies the result (synchronous check)

This makes the machine easier to reason about and test.

### Q: Can a reverted transaction ever become successful?

**A:** No. Once a transaction is mined and reverted, it's final. The transaction is permanently recorded on the blockchain with status='reverted'. You would need to submit a new transaction.

### Q: Does the user still pay gas for reverted transactions?

**A:** Yes! This is important to communicate to users. Even though the transaction failed:
- Gas was consumed during execution (up to the revert point)
- User paid `gasUsed × gasPrice` in ETH
- State changes were rolled back, but gas is not refunded

### Q: How can I prevent reverts?

**A:**
1. **Simulate first**: Use `publicClient.call()` to simulate before submitting
2. **Estimate gas**: Ensure gas limit is sufficient
3. **Validate inputs**: Check parameters before creating transaction
4. **Monitor state**: Ensure contract state hasn't changed since preparation

## Related States

- **Previous State**: [pending](./PENDING.md) - Waiting for mining
- **Success State**: [success](./SUCCESS.md) - Transaction succeeded
- **Error State**: [error.reverted](./ERROR_STATES.md#reverted-error) - Transaction failed

## Related Documentation

- [TRANSACTION_FLOW.md](../TRANSACTION_FLOW.md) - Complete transaction lifecycle
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System overview
