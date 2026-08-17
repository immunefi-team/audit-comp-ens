# Complete Transaction Flow: From Click to Completion

## Overview

This document traces the complete transaction lifecycle from user action to on-chain confirmation, showing how all components work together.

**For detailed state-by-state documentation**, see [transactionStates/README.md](./transactionStates/README.md).

## Quick Flow Summary

```
User creates intent + signer
       ↓
transactionManager.startTransaction()
       ↓
idle → preparing → submitting → pending → confirming → success
```

**Total time**: ~15-90 seconds (depends on user approval speed and network)

## Complete Example

### 1. Setup: Configure Public Client

```typescript
import { transactionManager } from '@ens-apps/transaction-manager'
import { usePublicClient } from 'wagmi'
import { sepolia } from 'viem/chains'

function App() {
  const publicClient = usePublicClient({ chainId: sepolia.id })

  // Configure once per chain
  useEffect(() => {
    if (publicClient) {
      transactionManager.setPublicClient(sepolia.id, publicClient)
    }
  }, [publicClient])

  return <ENSRenewalExample />
}
```

### 2. Create Intent and Start Transaction

```typescript
import { transactionManager } from '@ens-apps/transaction-manager'
import type { ENSRenewalTransactionIntent, EOASigner } from '@ens-apps/transaction-manager'

function ENSRenewalExample() {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const [currentTxId, setCurrentTxId] = useState<string | null>(null)

  const handleRenew = () => {
    // 1. Create intent (what you want)
    const intent: ENSRenewalTransactionIntent = {
      type: 'ens-renewal',
      name: 'leon',
      duration: 31536000n,  // 1 year
      from: address as `0x${string}`,
    }

    // 2. Create signer (how to sign)
    const signer: EOASigner = {
      type: 'eoa',
      walletClient: walletClient!,
    }

    // 3. Start transaction
    const txId = transactionManager.startTransaction(intent, signer, {
      chainId: sepolia.id,
      useSmartAccount: false,
    })

    setCurrentTxId(txId)
  }

  return <button onClick={handleRenew}>Renew Name</button>
}
```

### 3. Track Transaction State

```typescript
import { useSelector } from '@xstate/react'
import { match } from 'ts-pattern'

const txActor = currentTxId ? transactionManager.getTransaction(currentTxId) : null
const txState = useSelector(txActor, (s) => s?.value)
const txHash = useSelector(txActor, (s) => s?.context.hash)
const txReceipt = useSelector(txActor, (s) => s?.context.receipt)

{match(txState)
  .with('preparing', () => <div>⏳ Preparing transaction...</div>)
  .with('submitting', () => <div>📝 Waiting for wallet approval...</div>)
  .with('pending', () => <div>⛏️ Mining... {txHash}</div>)
  .with('success', () => <div>✅ Success! {txHash}</div>)
  .with(P.string.startsWith('error'), () => <div>❌ Error</div>)
  .otherwise(() => null)}
```

## State Machine Flow

The transaction progresses through these states:

### State 1: idle
**Duration**: Instant
**Waits for**: User to start transaction
**Produces**: Sets intent + signer in context

[→ Details: IDLE.md](./transactionStates/IDLE.md)

---

### State 2: preparing
**Duration**: 1-5 seconds
**Waits for**: Blockchain reads, calldata encoding
**Produces**: TransactionRequest + estimatedCost

**What happens**:
- Reads blockchain state (e.g., get ENS renewal price)
- Encodes function calldata
- Estimates gas (future)
- Creates TransactionRequest

[→ Details: PREPARING.md](./transactionStates/PREPARING.md)

---

### State 3: submitting
**Duration**: 1-30 seconds (user approval time)
**Waits for**: User wallet approval + network broadcast
**Produces**: Transaction hash

**What happens**:
- Wallet popup appears
- User reviews and approves
- Wallet signs with private key
- Transaction broadcast to network
- Network returns hash

[→ Details: SUBMITTING.md](./transactionStates/SUBMITTING.md)

---

### State 4: pending
**Duration**: 12-60 seconds (network mining time)
**Waits for**: Transaction to be mined
**Produces**: Transaction receipt

**What happens**:
- Polls blockchain for receipt
- Waits for transaction inclusion in block
- Waits for confirmations (default: 1)
- Returns receipt once confirmed

[→ Details: PENDING.md](./transactionStates/PENDING.md)

---

### State 5: confirming
**Duration**: Instant
**Waits for**: Nothing (synchronous check)
**Produces**: Success or error state

**What happens**:
- Checks `receipt.status`
- If 'success' → success state
- If 'reverted' → error.reverted state

[→ Details: CONFIRMING.md](./transactionStates/CONFIRMING.md)

---

### State 6: success
**Duration**: Terminal state
**Final state**: Transaction complete!

**What's available**:
- Transaction hash
- Full receipt
- Gas used
- Block number
- Event logs

[→ Details: SUCCESS.md](./transactionStates/SUCCESS.md)

---

## Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Transaction Lifecycle                    │
└─────────────────────────────────────────────────────────────┘

User clicks "Renew"
       │
       ▼
Create Intent + Signer
       │
       ▼
transactionManager.startTransaction()
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  idle                                                         │
│  • Machine created                                            │
│  • Waiting for START event                                   │
└──────────┬───────────────────────────────────────────────────┘
           │ START event
           ▼
┌──────────────────────────────────────────────────────────────┐
│  preparing                                     [1-5 seconds]  │
│  • Read blockchain state (get price)                         │
│  • Encode calldata                                            │
│  • Estimate gas                                               │
│  • Create TransactionRequest                                 │
└──────────┬───────────────────────────────────────────────────┘
           │ onDone
           ▼
┌──────────────────────────────────────────────────────────────┐
│  submitting                               [1-30 seconds]      │
│  • Wallet popup appears                                       │
│  • User approves                                              │
│  • Sign transaction                                           │
│  • Broadcast to network                                       │
│  • Return hash                                                │
└──────────┬───────────────────────────────────────────────────┘
           │ onDone (hash received)
           ▼
┌──────────────────────────────────────────────────────────────┐
│  pending                                  [12-60 seconds]     │
│  • Poll for receipt                                           │
│  • Wait for mining                                            │
│  • Wait for confirmations                                     │
└──────────┬───────────────────────────────────────────────────┘
           │ onDone (receipt received)
           ▼
┌──────────────────────────────────────────────────────────────┐
│  confirming                                    [Instant]      │
│  • Check receipt.status                                       │
│  • Verify success or revert                                   │
└──────────┬───────────────────────────────────────────────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
 success      error.reverted
     │
     ▼
Transaction Complete! ✅
```

## Error Handling

Errors can occur at multiple stages:

```
preparing → error.preparation
  • Invalid intent
  • Blockchain read failed
  • Encoding error

submitting → error.submission
  • User rejected
  • Insufficient funds
  • Network error

submitting → retrying → submitting
  • Network error (with retries available)

pending → error.timeout
  • Transaction not mined in time

pending → checkingFallback → pending
  • Timeout fallback check

confirming → error.reverted
  • Transaction mined but execution failed
```

For error handling details, see individual state documentation.

## Key Architecture Principles

### 1. Intent-Based API

Users describe **what** they want, not **how** to do it:

```typescript
// ✅ Intent-based (high-level)
const intent: ENSRenewalTransactionIntent = {
  type: 'ens-renewal',
  name: 'leon',
  duration: 31536000n,
  from: address,
}

// ❌ Manual preparation (low-level)
const price = await getPrice(name, duration)
const data = encodeFunctionData(...)
const request = { to, data, value: price }
```

### 2. Signer Abstraction

Signing method is separate from transaction data:

```typescript
// Same intent works with any signer
const intent = { type: 'ens-renewal', ... }

// EOA signer
const eoaSigner = { type: 'eoa', walletClient }

// Rhinestone signer
const rhinestoneSigner = { type: 'rhinestone', account, config }

// Both work the same way
transactionManager.startTransaction(intent, signer, options)
```

### 3. Explicit State Transitions

Every state change is logged and visible:

```typescript
import { getTransitionHistory } from '@ens-apps/transaction-manager'

const history = getTransitionHistory('transaction')
// [
//   { from: undefined, to: 'idle', event: 'xstate.init' },
//   { from: 'idle', to: 'preparing', event: 'START' },
//   { from: 'preparing', to: 'submitting', event: 'xstate.done...' },
//   ...
// ]
```

### 4. Pure Functions + State Machines

- Business logic lives in **pure functions** (testable, reusable)
- State management lives in **XState machines** (auditable, explicit)
- Never mix state in service classes

## Testing the Flow

### Unit Test: Individual States

```typescript
import { createActor } from 'xstate'
import { transactionMachine } from '@ens-apps/transaction-manager'

test('machine transitions through states correctly', async () => {
  const actor = createActor(transactionMachine, {
    input: { publicClient: mockPublicClient }
  })

  actor.start()

  // Initial state
  expect(actor.getSnapshot().value).toBe('idle')

  // Send START event
  actor.send({
    type: 'START',
    intent: mockIntent,
    signer: mockSigner,
    chainId: 11155111,
  })

  // Should transition to preparing
  await waitFor(() => {
    expect(actor.getSnapshot().value).toBe('preparing')
  })

  // Eventually reaches success
  await waitFor(() => {
    expect(actor.getSnapshot().value).toBe('success')
  }, { timeout: 120000 })
})
```

### Integration Test: Complete Flow

```typescript
import { transactionManager } from '@ens-apps/transaction-manager'

test('complete ENS renewal flow', async () => {
  const txId = transactionManager.startTransaction(
    {
      type: 'ens-renewal',
      name: 'test',
      duration: 31536000n,
      from: testAccount,
    },
    { type: 'eoa', walletClient: testWallet },
    { chainId: 11155111 }
  )

  const actor = transactionManager.getTransaction(txId)

  await waitFor(() => {
    expect(actor.getSnapshot().value).toBe('success')
  }, { timeout: 120000 })

  const { hash, receipt } = actor.getSnapshot().context

  expect(hash).toBeDefined()
  expect(receipt?.status).toBe('success')
})
```

## Monitoring and Debugging

### Console Logs

Every major step logs with emoji prefixes:

- `🔧 [STATE MACHINE]` - State changes
- `📤` - Submitting transactions
- `📝` - Signature requests
- `✅` - Success operations
- `❌` - Errors

### Audit Trail

```typescript
import { generateDebugReport } from '@ens-apps/transaction-manager'

const report = generateDebugReport()
console.log(report)
```

### XState Inspector

```typescript
import { inspect } from '@xstate/inspect'

inspect({ iframe: false })
// Machine visualized in browser devtools
```

## Related Documentation

- [transactionStates/README.md](./transactionStates/README.md) - Detailed state documentation
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture overview
- [SIGNERS.md](./SIGNERS.md) - How signing works
- [README.md](./README.md) - Quick start and API reference

## Next Steps

1. **Read state documentation** - Deep dive into each state in [transactionStates/](./transactionStates/)
2. **Understand signers** - Learn about different account types in [SIGNERS.md](./SIGNERS.md)
3. **See complete architecture** - Read the full system design in [ARCHITECTURE.md](./ARCHITECTURE.md)
