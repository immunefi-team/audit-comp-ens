# Idle State

## Overview

The `idle` state is the initial state of the transaction machine. The machine waits in this state until it receives a transaction intent to process.

## When Machine Enters This State

- When the machine is first created via `transactionManager.startTransaction()`
- After a transaction completes successfully (can start another transaction)
- The machine can return to idle after certain error states (if designed to retry)

## What Happens in This State

### Entry Actions
```typescript
idle: {
  entry: ['recordTransition']
  // Logs state transition to audit trail
}
```

### Accepted Events

The machine listens for the `START` event with a transaction intent:

```typescript
on: {
  START: {
    target: 'preparing',
    actions: assign({
      intent: ({ event }) => event.intent,
      signer: ({ event }) => event.signer,
      chainId: ({ event }) => event.chainId,
      useSmartAccount: ({ event }) => event.useSmartAccount,
      options: ({ event }) => event.options || {},
    })
  }
}
```

## Context at This Stage

```typescript
{
  publicClient: PublicClient,  // Pre-configured for the chain
  intent: undefined,            // No intent yet
  signer: undefined,            // No signer yet
  request: undefined,           // No prepared request yet
  hash: undefined,              // No transaction hash yet
  receipt: undefined,           // No receipt yet
  error: undefined,             // No errors yet
  // ...
}
```

## Transitions

### Success Path
```
idle → START event received → preparing
```

### Error Path
None. The idle state has no error conditions.

## User Experience

**What the user sees:**
- Nothing yet - the transaction hasn't started
- In a UI, this might show as a "Ready" or "Start Transaction" button state

**What the user can do:**
- Click a button to create an intent and start the transaction
- The button should be enabled and ready to click

## Example Usage

```typescript
import { transactionManager } from '@ens-apps/transaction-manager'

// Machine starts in idle state
const txId = transactionManager.startTransaction(intent, signer, options)

// Machine immediately transitions from idle → preparing
// (The START event is sent internally by startTransaction)
```

## Code Location

**File**: `packages/transaction-manager/src/machines/transaction.machine.ts`

```typescript
idle: {
  entry: ['recordTransition'],
  on: {
    START: {
      target: 'preparing',
      actions: assign({
        intent: ({ event }) => event.intent,
        signer: ({ event }) => event.signer,
        chainId: ({ event }) => event.chainId,
        useSmartAccount: ({ event }) => event.useSmartAccount,
        options: ({ event }) => event.options || {},
      })
    }
  }
}
```

## Testing This State

```typescript
import { createActor } from 'xstate'
import { transactionMachine } from '@ens-apps/transaction-manager'

test('machine starts in idle state', () => {
  const actor = createActor(transactionMachine, {
    input: { publicClient: mockPublicClient }
  })

  actor.start()

  expect(actor.getSnapshot().value).toBe('idle')
  expect(actor.getSnapshot().context.intent).toBeUndefined()
  expect(actor.getSnapshot().context.hash).toBeUndefined()
})

test('START event transitions to preparing', () => {
  const actor = createActor(transactionMachine, {
    input: { publicClient: mockPublicClient }
  })

  actor.start()

  actor.send({
    type: 'START',
    intent: mockIntent,
    signer: mockSigner,
    chainId: 11155111,
    useSmartAccount: false,
  })

  expect(actor.getSnapshot().value).toBe('preparing')
  expect(actor.getSnapshot().context.intent).toEqual(mockIntent)
})
```

## Common Questions

### Q: Can the machine return to idle after a transaction completes?

**A:** Yes, if the machine is designed to handle multiple sequential transactions. After reaching `success` state, you could send another `START` event to process a new transaction.

### Q: What if I send a START event with invalid data?

**A:** The machine will transition to `preparing` state, and the preparation actor will handle validation. Invalid intents will cause a transition to `error.preparation`.

### Q: How long does the machine stay in idle?

**A:** Indefinitely, until a `START` event is received. There's no timeout in the idle state.

## Related States

- **Next State**: [preparing](./PREPARING.md) - Where transaction preparation happens
- **Error States**: None directly from idle

## Related Documentation

- [ARCHITECTURE.md](../ARCHITECTURE.md) - Overall system architecture
- [TRANSACTION_FLOW.md](../TRANSACTION_FLOW.md) - Complete transaction lifecycle
