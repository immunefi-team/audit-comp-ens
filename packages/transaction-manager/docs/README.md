# Transaction Manager Documentation

Welcome to the Transaction Manager documentation. This package provides a robust, state machine-based transaction management system for Ethereum applications.

## Quick Start

```typescript
import { transactionManager } from '@ens-apps/transaction-manager'
import type { ENSRenewalTransactionIntent } from '@ens-apps/transaction-manager'

// 1. Configure public client (once per chain)
transactionManager.setPublicClient(sepolia.id, publicClient)

// 2. Create transaction intent
const intent: ENSRenewalTransactionIntent = {
  type: 'ens-renewal',
  name: 'leon',
  duration: 31536000n, // 1 year in seconds
  from: account.address,
}

// 3. Create signer
const signer = {
  type: 'eoa',
  walletClient,
}

// 4. Start transaction
const txId = transactionManager.startTransaction(intent, signer, {
  chainId: sepolia.id,
})

// 5. Track transaction state
const actor = transactionManager.getTransaction(txId)
const state = actor.getSnapshot().value // 'preparing' | 'submitting' | 'pending' | 'success'
```

## Core Concepts

### 1. Transaction Intents

**Transaction Intents** are high-level descriptions of what the user wants to do. They are distinct from Rhinestone intents (which are for chain abstraction).

```typescript
// Instead of manually preparing transactions...
const request = {
  to: ENS_CONTROLLER,
  data: encodeFunctionData(...),
  value: await getPrice(...),
}

// ...describe your intent
const intent: ENSRenewalTransactionIntent = {
  type: 'ens-renewal',
  name: 'leon',
  duration: 31536000n,
  from: myAddress,
}
```

The transaction manager automatically:
- Prepares the transaction (gets price, encodes data)
- Estimates gas
- Handles submission
- Confirms completion

### 2. Signers

**Signers** represent the capability to sign transactions. Different account types use different signers:

```typescript
// EOA (Externally Owned Account)
const signer: EOASigner = {
  type: 'eoa',
  walletClient,
}

// Rhinestone Smart Account
const signer: RhinestoneSigner = {
  type: 'rhinestone',
  account: rhinestoneAccount,
  config: rhinestoneConfig,
}

// Safe Multisig (future)
const signer: SafeSigner = {
  type: 'safe',
  safeClient,
  walletClient,
}
```

The signer abstraction decouples **what** you're doing (intent) from **how** you're signing it (signer).

### 3. State Machine

All transactions are managed by an XState machine with explicit states:

```
idle → preparing → submitting → pending → confirming → success
         ↓            ↓           ↓            ↓
       error        error       error        error
```

This ensures:
- Every state transition is logged
- Impossible states are prevented
- Business logic is centralized
- Easy debugging and testing

## Documentation

### Architecture Documents

| Document | Description | Status |
|----------|-------------|--------|
| [Architecture](./ARCHITECTURE.md) | Up-to-date overview of the intent-based architecture | ✅ Complete |
| [Transaction Flow](./TRANSACTION_FLOW.md) | Complete transaction lifecycle and state machine design | ✅ Complete |
| [Signers](./SIGNERS.md) | How different account types work (EOA, Rhinestone, Safe, etc.) | ✅ Complete |
| [Signer Refactor](./SIGNER_REFACTOR.md) | Migration from tightly coupled design to Signer abstraction | ✅ Complete |

### Transaction States

Detailed documentation for each state in the transaction flow:

| State | Description | Documentation |
|-------|-------------|---------------|
| **Overview** | State flow, context changes, common patterns | [transactionStates/README.md](./transactionStates/README.md) |
| idle | Initial state, waiting for transaction intent | [transactionStates/IDLE.md](./transactionStates/IDLE.md) |
| preparing | Prepare transaction (get price, encode data, estimate gas) | [transactionStates/PREPARING.md](./transactionStates/PREPARING.md) |
| submitting | Sign and broadcast transaction (waiting for hash) | [transactionStates/SUBMITTING.md](./transactionStates/SUBMITTING.md) |
| pending | Wait for transaction to be mined (waiting for receipt) | [transactionStates/PENDING.md](./transactionStates/PENDING.md) |
| confirming | Verify transaction succeeded or reverted | [transactionStates/CONFIRMING.md](./transactionStates/CONFIRMING.md) |
| success | Transaction completed successfully | [transactionStates/SUCCESS.md](./transactionStates/SUCCESS.md) |

### Future Documentation

| Document | Description | Status |
|----------|-------------|--------|
| Intents System | Deep dive into transaction intents vs Rhinestone intents | 📝 TODO |
| Simulation Service | Live transaction simulation for user feedback | 📝 TODO |
| Gas Estimation | Comprehensive gas estimation strategies | 📝 TODO |
| Error Handling | Error types, recovery strategies, and user feedback | 📝 TODO |
| Testing Guide | Unit testing intents, signers, and state machines | 📝 TODO |
| Multi-chain Support | Handling transactions across multiple chains | 📝 TODO |

## Architecture Principles

### 1. Separation of Concerns

- **Intents** - What the user wants to do (high-level)
- **Preparation** - How to construct the transaction (get price, encode data, estimate gas)
- **Signing** - How to authorize the transaction (EOA, smart account, multisig)
- **Submission** - How to send the transaction (direct, bundler, intent execution)
- **Confirmation** - How to verify completion (wait for receipt, check finality)

### 2. State Machines Over Services

All critical state is managed by XState machines, not service classes:

```typescript
// ❌ Avoid: Stateful service classes
class TransactionService {
  private pendingTx: Hash | undefined // Hidden state

  async submit() {
    this.pendingTx = await send() // Implicit state change
  }
}

// ✅ Prefer: Stateless actors with explicit state machines
export function submitTransaction(input) {
  return ResultAsync.fromPromise(...)
}

// Used in machine
const machine = setup({
  actors: { submitTransaction }
}).createMachine({
  states: {
    submitting: {
      invoke: {
        src: 'submitTransaction',
        onDone: { target: 'pending' }, // Explicit transition
      }
    }
  }
})
```

### 3. Pure Functions for Business Logic

Handlers and helpers should be pure functions outside React components:

```typescript
// ❌ Avoid: Business logic in components
function Component() {
  const handleSubmit = async () => {
    const price = await getPrice()
    const data = encodeFunction()
    await send({ price, data })
  }
}

// ✅ Prefer: Pure external functions
export async function prepareRenewal(
  params: RenewalParams,
  handlers: RenewalHandlers
): Promise<void> {
  const price = await getPrice(params)
  const data = encodeFunction(params)
  handlers.onSuccess({ price, data })
}

function Component() {
  const handleSubmit = () => {
    prepareRenewal(params, {
      onSuccess: (data) => transactionManager.startTransaction(...)
    })
  }
}
```

### 4. neverthrow for Error Handling

All async operations return `Result` or `ResultAsync`:

```typescript
// ❌ Avoid: try-catch with thrown errors
async function getPrice(): Promise<bigint> {
  try {
    return await contract.rentPrice()
  } catch (error) {
    throw new Error('Failed to get price')
  }
}

// ✅ Prefer: neverthrow Result type
function getPrice(): ResultAsync<bigint, Error> {
  return ResultAsync.fromPromise(
    contract.rentPrice(),
    (error) => new Error('Failed to get price')
  )
}
```

## Common Patterns

### Pattern 1: Intent-Based Transaction

```typescript
// Create intent
const intent: ENSRenewalTransactionIntent = {
  type: 'ens-renewal',
  name: 'leon',
  duration: 31536000n,
  from: account.address,
}

// Start transaction
const txId = transactionManager.startTransaction(intent, signer, {
  chainId: sepolia.id,
  modal: {
    title: 'Renew leon.eth',
    description: 'Renewing for 1 year',
  },
})
```

### Pattern 2: Track Transaction State

```typescript
// Get actor by ID
const actor = transactionManager.getTransaction(txId)

// Subscribe to state changes
const subscription = actor.subscribe((snapshot) => {
  const state = snapshot.value
  console.log('Transaction state:', state)

  if (state === 'success') {
    console.log('Hash:', snapshot.context.hash)
  }
})
```

### Pattern 3: React Integration with useSelector

```typescript
import { useSelector } from '@xstate/react'

function TransactionStatus({ txId }) {
  const actor = transactionManager.getTransaction(txId)

  const state = useSelector(actor, (s) => s.value)
  const hash = useSelector(actor, (s) => s.context.hash)
  const error = useSelector(actor, (s) => s.context.error)

  return (
    <div>
      State: {state}
      {hash && <div>Hash: {hash}</div>}
      {error && <div>Error: {error.message}</div>}
    </div>
  )
}
```

## Key Advantages

### 1. Intent-Based API

Describe **what** you want, not **how** to do it:

```typescript
// Before: Manual preparation
const price = await getPrice(name, duration)
const data = encodeFunctionData(...)
const request = { to, data, value: price }
const hash = await walletClient.sendTransaction(request)

// After: Intent-based
const txId = transactionManager.startTransaction({
  type: 'ens-renewal',
  name: 'leon',
  duration: 31536000n,
  from: account.address,
}, signer, { chainId })
```

### 2. Signer Abstraction

Same intent works with any signer type:

```typescript
const intent = { type: 'ens-renewal', name: 'leon', ... }

// EOA
transactionManager.startTransaction(intent, { type: 'eoa', walletClient }, ...)

// Rhinestone
transactionManager.startTransaction(intent, { type: 'rhinestone', account, config }, ...)

// Safe (future)
transactionManager.startTransaction(intent, { type: 'safe', safeClient, walletClient }, ...)
```

### 3. Explicit State Management

Every state transition is visible and auditable:

```typescript
// View complete state history
const history = actor.getSnapshot().history

// Debug state machine
actor.subscribe((snapshot) => {
  console.log('State:', snapshot.value)
  console.log('Context:', snapshot.context)
  console.log('Events:', snapshot.events)
})
```

### 4. SSR Safe

Module-level singleton with no user-specific state in shared storage:

```typescript
// Safe to use in Next.js, Remix, etc.
import { transactionManager } from '@ens-apps/transaction-manager'

// Public clients are shared (safe - no user data)
transactionManager.setPublicClient(sepolia.id, publicClient)

// Each transaction gets its own isolated actor
const txId = transactionManager.startTransaction(intent, signer, options)
```

## Migration Guide

If you're migrating from the old helper-based approach:

### Before:
```typescript
import { startRenewalTransaction } from './helpers/renewal'

const result = await startRenewalTransaction(formData, {
  type: 'eoa',
  walletClient,
  publicClient,
  chainId,
})
```

### After:
```typescript
import { transactionManager } from '@ens-apps/transaction-manager'

const intent: ENSRenewalTransactionIntent = {
  type: 'ens-renewal',
  name: formData.name,
  duration: BigInt(formData.duration) * YEAR_IN_SECONDS,
  from: account.address,
}

const signer = { type: 'eoa', walletClient }

const txId = transactionManager.startTransaction(intent, signer, {
  chainId: sepolia.id,
})
```

## FAQ

**Q: What's the difference between TransactionIntent and Rhinestone Intent?**

A: **Transaction Intents** are high-level descriptions for our transaction manager (e.g., "renew an ENS name"). **Rhinestone Intents** are chain abstraction intents used by the Rhinestone SDK for cross-chain execution. They are separate concepts.

**Q: Why do we need a preparing state?**

A: Preparation involves async operations (getting renewal price, estimating gas) that can fail. Having an explicit state allows us to retry, show progress to the user, and audit the full transaction lifecycle.

**Q: Can I use pre-prepared transactions instead of intents?**

A: Yes! Use the `CustomTransactionIntent`:

```typescript
const intent: CustomTransactionIntent = {
  type: 'custom',
  request: myPreparedRequest,
}
```

**Q: How do I handle transaction errors?**

A: Subscribe to the actor and check the error state:

```typescript
const error = useSelector(actor, (s) => s.context.error)
const errorType = useSelector(actor, (s) => s.value) // 'error.preparation', 'error.submission', etc.
```

## Contributing

When adding new features:

1. ✅ Document in the appropriate `.md` file
2. ✅ Update this README with links
3. ✅ Add examples to the example package
4. ✅ Write tests for new functionality
5. ✅ Update type exports in `src/index.ts`

## Support

- **Issues**: https://github.com/ensdomains/ens-app-v3/issues
- **Discussions**: https://github.com/ensdomains/ens-app-v3/discussions
- **Discord**: https://chat.ens.domains/
