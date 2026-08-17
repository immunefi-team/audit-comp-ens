# Pending State

## Overview

The `pending` state is where the machine waits for the transaction to be mined (included in a block on the blockchain). At this point, the transaction has been broadcast to the network and we have a transaction hash, but it hasn't been confirmed yet.

## When Machine Enters This State

- After successful submission (`submitting` → `pending`)
- The machine has a transaction hash from the network
- The transaction is in the mempool waiting to be mined

## What Happens in This State

### Entry Actions
```typescript
pending: {
  entry: ['recordTransition']
  // Logs state transition to audit trail
}
```

### Waiting Process

The machine invokes the `waitForReceipt` actor, which:

1. **Polls the blockchain** for the transaction receipt
2. **Waits for confirmations** (default: 1 block)
3. **Times out** if transaction takes too long (default: 60 seconds)
4. **Returns receipt** once transaction is mined

```typescript
invoke: {
  src: 'waitForReceipt',
  input: ({ context }) => ({
    hash: context.hash!,
    options: context.options,
    publicClient: context.publicClient,
  }),
  onDone: {
    target: 'confirming',
    actions: assign({
      receipt: ({ event }) => event.output  // Store transaction receipt
    })
  },
  onError: [
    {
      guard: 'shouldCheckFallback',  // Can try eth_call fallback?
      target: 'checkingFallback',
      actions: assign({
        fallbackChecks: ({ context }) => context.fallbackChecks + 1
      })
    },
    {
      target: 'error.timeout',  // Out of fallback checks
      actions: assign({
        error: ({ event }) => event.error as Error
      })
    }
  ]
},
on: {
  FORCE_SUCCESS: {  // Manual override
    target: 'success',
    actions: 'recordTransition'
  }
}
```

## Timeline

```
Enter pending state (have hash)
       ↓
waitForReceipt actor invoked
       ↓
┌─────────────────────────────────────┐
│ Polling Blockchain                  │
│ publicClient.waitForTransactionReceipt() │
└─────────────────────────────────────┘
       ↓
[Transaction in mempool]
       ↓
Miner includes transaction in block
       ↓
Block is mined
       ↓
Wait for confirmations (default: 1)
       ↓
Confirmation block is mined
       ↓
Receipt is available
       ↓
waitForReceipt actor completes
       ↓
onDone → transition to 'confirming'
```

**Duration**:
- **Mainnet**: ~12-15 seconds (average block time)
- **Sepolia/Goerli**: ~12-15 seconds
- **Can be longer**: During network congestion or low gas price
- **Timeout**: Default 60 seconds

## Context Before This State

```typescript
{
  publicClient: PublicClient,
  intent: TransactionIntent,
  request: TransactionRequest,
  signer: Signer,
  hash: Hash,                // ✅ Have transaction hash
  receipt: undefined,        // ← Will be set after mining
  error: undefined,
}
```

## Context After This State

```typescript
{
  // ... same as before, plus:
  receipt: TransactionReceipt,  // ✅ Transaction mined!
}
```

## Transitions

### Success Path
```
pending → receipt received → confirming
```

### Error Paths
```
pending → timeout → checkingFallback (if fallback checks available)
pending → timeout → error.timeout (no fallback checks left)
pending → FORCE_SUCCESS event → success (manual override)
```

## User Experience

**What the user sees:**
- Transaction hash (link to block explorer)
- "Transaction pending..." message
- Loading spinner
- Estimated time remaining (optional)

**What the user can do:**
- View transaction on block explorer (Etherscan)
- Wait for confirmation
- In rare cases, send a FORCE_SUCCESS event to manually mark as complete

**UI Recommendations:**
```typescript
const txState = useSelector(txActor, (s) => s?.value)
const txHash = useSelector(txActor, (s) => s?.context.hash)

{match(txState)
  .with('pending', () => (
    <div>
      <Spinner />
      <p>Transaction pending...</p>
      <p className="text-sm">
        Waiting for confirmation on the blockchain
      </p>
      {txHash && (
        <a
          href={`https://sepolia.etherscan.io/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          View on Etherscan ↗
        </a>
      )}
    </div>
  ))
  // ...
}
```

## Wait For Receipt Actor

**File**: `packages/transaction-manager/src/machines/transaction.machine.ts`

```typescript
waitForReceipt: fromResultAsync(
  ({ hash, options, publicClient }): ResultAsync<TransactionReceipt, TransactionTimeoutError> => {
    const confirmations = options?.confirmations || 1
    const timeout = options?.timeout || 60000

    return fromPromiseNT(
      publicClient.waitForTransactionReceipt({
        hash,
        confirmations,
        timeout
      }),
      (error) => new TransactionTimeoutError(hash, timeout)
    )
  }
)
```

## How waitForTransactionReceipt Works

```typescript
// Viem's waitForTransactionReceipt
await publicClient.waitForTransactionReceipt({
  hash: '0x123...',
  confirmations: 1,  // Wait for 1 additional block after transaction's block
  timeout: 60000     // Timeout after 60 seconds
})
```

**What it does:**
1. Polls `eth_getTransactionReceipt(hash)` repeatedly
2. If receipt not found: Wait ~500ms and try again
3. If receipt found: Check if enough blocks have been mined since
4. If confirmations reached: Return receipt
5. If timeout reached: Throw error

## Confirmations Explained

```typescript
// confirmations: 1 (default)
Transaction mined in block N
       ↓
Wait for block N+1 to be mined
       ↓
Return receipt

// confirmations: 3
Transaction mined in block N
       ↓
Wait for blocks N+1, N+2, N+3 to be mined
       ↓
Return receipt
```

**Why wait for confirmations?**
- Protects against chain reorganizations
- Higher confirmations = more secure (harder to reverse)
- For most use cases, 1 confirmation is sufficient
- For high-value transactions, use 3-12 confirmations

## Fallback Mechanism

If `waitForReceipt` times out, the machine can try a fallback:

```typescript
checkingFallback: {
  // Uses eth_call to simulate transaction
  // If call succeeds, transaction likely succeeded
  // Can force success if confident
}
```

This handles cases where:
- Network issues prevent receipt retrieval
- Transaction was mined but not confirmed in time
- RPC node is lagging

## Common Errors

### Transaction Timeout
```typescript
error: {
  name: 'TransactionTimeoutError',
  message: 'Transaction timeout after 60000ms',
  hash: '0x123...',
  timeout: 60000
}
```

**Possible causes:**
- Transaction gas price too low (outbid by others)
- Network congestion
- Transaction stuck in mempool

**Solutions:**
1. Wait longer (transaction may still complete)
2. Check transaction status on block explorer
3. Speed up transaction (send replacement with higher gas)
4. Cancel transaction (send replacement with same nonce to self)

### RPC Error
```typescript
error: {
  name: 'TransactionTimeoutError',
  message: 'RPC request failed',
  cause: NetworkError
}
```

**Solutions:**
- Check RPC connection
- Try different RPC endpoint
- Wait and retry

## Transaction Status Checks

While in pending state, you can manually check status:

```typescript
// Get current transaction status
const tx = await publicClient.getTransaction({ hash })
console.log(tx)  // Transaction details

// Get receipt (null if not mined yet)
const receipt = await publicClient.getTransactionReceipt({ hash })
console.log(receipt)  // Receipt or null

// Get current block number
const blockNumber = await publicClient.getBlockNumber()
console.log(`Current block: ${blockNumber}`)
```

## Code Location

**File**: `packages/transaction-manager/src/machines/transaction.machine.ts`

```typescript
pending: {
  entry: 'recordTransition',
  invoke: {
    src: 'waitForReceipt',
    input: ({ context }) => ({
      hash: context.hash!,
      options: context.options,
      publicClient: context.publicClient,
    }),
    onDone: {
      target: 'confirming',
      actions: assign({
        receipt: ({ event }) => event.output
      })
    },
    onError: [ ... ]
  },
  on: {
    FORCE_SUCCESS: {
      target: 'success',
      actions: 'recordTransition'
    }
  }
}
```

## Testing This State

```typescript
import { createActor } from 'xstate'
import { transactionMachine } from '@ens-apps/transaction-manager'

test('successful mining returns receipt', async () => {
  const mockPublicClient = {
    waitForTransactionReceipt: vi.fn().mockResolvedValue({
      status: 'success',
      transactionHash: '0xhash123',
      blockNumber: 12345n,
      gasUsed: 21000n,
    })
  }

  const actor = createActor(transactionMachine, {
    input: {
      hash: '0xhash123',
      publicClient: mockPublicClient,
      options: { confirmations: 1, timeout: 60000 }
    }
  })

  actor.start()

  await waitFor(() => {
    expect(actor.getSnapshot().value).toBe('confirming')
    expect(actor.getSnapshot().context.receipt?.status).toBe('success')
  })
})

test('timeout triggers fallback check', async () => {
  const mockPublicClient = {
    waitForTransactionReceipt: vi.fn().mockRejectedValue(
      new Error('Timeout')
    )
  }

  const actor = createActor(transactionMachine, { ... })
  actor.start()

  await waitFor(() => {
    expect(actor.getSnapshot().value).toBe('checkingFallback')
  })
})
```

## Common Questions

### Q: How long should I wait in pending state?

**A:** The default timeout is 60 seconds. Most transactions on mainnet/testnets confirm in 12-15 seconds. If it's taking longer:
- Check gas price (may be too low)
- Check network congestion (view mempool on Etherscan)
- Consider increasing timeout for congested networks

### Q: What if the transaction is stuck in pending forever?

**A:** This usually means:
1. Gas price too low - Transaction will eventually be dropped from mempool
2. Nonce issue - Previous transaction needs to complete first
3. Network issue - RPC node may be lagging

You can:
- Wait for it to be dropped (usually 24-48 hours)
- Speed it up (replace with higher gas price)
- Cancel it (replace with 0-value transaction to self)

### Q: Can I show progress to the user?

**A:** Yes! You can poll the current block number and estimate progress:

```typescript
const tx = await publicClient.getTransaction({ hash })
const currentBlock = await publicClient.getBlockNumber()

if (tx && tx.blockNumber) {
  const confirmations = currentBlock - tx.blockNumber
  console.log(`${confirmations} confirmations so far`)
}
```

### Q: What's the difference between pending and confirming?

**A:**
- **pending**: Waiting for transaction to be mined (no receipt yet)
- **confirming**: Transaction is mined (have receipt), checking if it succeeded or reverted

## Related States

- **Previous State**: [submitting](./SUBMITTING.md) - Transaction submission
- **Next State**: [confirming](./CONFIRMING.md) - Verify success/revert
- **Error State**: [error.timeout](./ERROR_STATES.md#timeout-error) - Mining timeout
- **Fallback State**: [checkingFallback](./CHECKING_FALLBACK.md) - eth_call verification

## Related Documentation

- [TRANSACTION_FLOW.md](../TRANSACTION_FLOW.md) - Complete transaction lifecycle
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System overview
