# Submitting State

## Overview

The `submitting` state is where the transaction is signed by the user and broadcast to the blockchain network. This state waits for the wallet to return a transaction hash.

## When Machine Enters This State

- After successful preparation (`preparing` → `submitting`)
- The machine has a valid `TransactionRequest` ready to sign and submit

## What Happens in This State

### Entry Actions
```typescript
submitting: {
  entry: [
    'recordTransition',
    ({ context }) => {
      console.log('🔧 [STATE MACHINE] Entering submitting state', {
        requestType: context.request?.type,
        hasSigner: !!context.signer,
      })
    }
  ]
}
```

### Submission Process

The machine invokes the `submitTransaction` actor, which:

1. **Routes by signer type** (EOA, Rhinestone, etc.)
2. **Prompts user for approval** in wallet popup
3. **Signs the transaction** with private key
4. **Broadcasts to network** via RPC
5. **Returns transaction hash** (does NOT wait for mining)

```typescript
invoke: {
  src: 'submitTransaction',
  input: ({ context }) => ({
    request: context.request,
    signer: context.signer,
    publicClient: context.publicClient,
  }),
  onDone: {
    target: 'pending',
    actions: assign({
      hash: ({ event }) => event.output  // Store transaction hash
    })
  },
  onError: [
    {
      guard: 'canRetry',
      target: 'retrying',
      actions: [
        assign({
          error: ({ event }) => event.error as Error,
          retryCount: ({ context }) => context.retryCount + 1
        }),
        'logError',
      ]
    },
    {
      target: 'error.submission',
      actions: [
        assign({ error: ({ event }) => event.error as Error }),
        'logCritical',
      ]
    }
  ]
}
```

## Timeline

```
Enter submitting state
       ↓
submitTransaction actor invoked
       ↓
┌─────────────────────────────────────┐
│ Wallet Popup Appears                │
│ User reviews transaction details    │
│ User clicks "Approve" or "Reject"   │
└─────────────────────────────────────┘
       ↓
[User approved]
       ↓
Wallet signs transaction
       ↓
Wallet broadcasts to network
       ↓
Network accepts into mempool
       ↓
Network returns transaction hash
       ↓
submitTransaction actor completes
       ↓
onDone → transition to 'pending'
```

**Duration**: Typically 1-30 seconds (depends on user approval speed)

## Context Before This State

```typescript
{
  publicClient: PublicClient,
  intent: TransactionIntent,
  request: TransactionRequest,  // ✅ Prepared and ready
  signer: Signer,               // ✅ Ready to sign
  chainId: number,
  useSmartAccount: boolean,
  hash: undefined,              // ← Will be set after submission
  receipt: undefined,
  error: undefined,
}
```

## Context After This State

```typescript
{
  // ... same as before, plus:
  hash: Hash,  // ✅ Transaction hash received
}
```

## Transitions

### Success Path
```
submitting → hash received → pending
```

### Error Paths
```
submitting → user rejects → error.submission
submitting → network error → retrying (if retries available)
submitting → network error → error.submission (no retries left)
```

## User Experience

**What the user sees:**
- Wallet popup asking for approval
- Transaction details (to, value, gas estimate)
- "Approve" and "Reject" buttons in wallet
- Loading spinner in your app while waiting

**What the user can do:**
- Review transaction details in wallet
- Approve the transaction
- Reject the transaction
- Adjust gas settings (in some wallets)

**UI Recommendations:**
```typescript
const txState = useSelector(txActor, (s) => s?.value)

{match(txState)
  .with('submitting', () => (
    <div>
      <Spinner />
      <p>Waiting for wallet approval...</p>
      <p className="text-sm text-gray-500">
        Please check your wallet to approve this transaction
      </p>
    </div>
  ))
  // ...
}
```

## Common Errors

### User Rejected Transaction
```typescript
error: {
  name: 'TransactionSubmissionError',
  message: 'User rejected the request',
  cause: UserRejectedRequestError
}
```

**Solution**: User must approve in wallet to proceed.

### Insufficient Funds
```typescript
error: {
  name: 'TransactionSubmissionError',
  message: 'Insufficient funds for gas * price + value',
  cause: InsufficientFundsError
}
```

**Solution**: User needs to add more ETH to their account.

### Nonce Too Low
```typescript
error: {
  name: 'TransactionSubmissionError',
  message: 'Nonce too low',
  cause: NonceError
}
```

**Solution**: Retry the transaction (machine will retry automatically if `canRetry` guard passes).

### Network Error
```typescript
error: {
  name: 'TransactionSubmissionError',
  message: 'Network request failed',
  cause: NetworkError
}
```

**Solution**: Check RPC connection, retry transaction.

## Transport Actors

The `submitTransaction` actor routes to different implementations based on signer type:

### EOA Transport
```typescript
// src/actors/eoa-transport.actor.ts
export function submitEOATransaction(input: {
  request: TransactionRequest
  signer: EOASigner
}): ResultAsync<Hash, TransactionSubmissionError> {
  const { walletClient } = signer

  return fromPromiseNT(
    walletClient.sendTransaction({
      to: request.to,
      data: request.data,
      value: request.value,
      // ...
    }),
    (error) => new TransactionSubmissionError(request, error)
  )
}
```

### Rhinestone Transport
```typescript
// src/actors/rhinestone-transport.actor.ts
export function submitRhinestoneTransaction(input: {
  request: TransactionRequest
  signer: RhinestoneSigner
  publicClient: PublicClient
}): ResultAsync<Hash, TransactionSubmissionError> {
  const { account, config } = signer

  return ResultAsync.fromSafePromise(
    account.sendTransaction({
      sourceChains: [config.chain],
      targetChain: config.chain,
      calls: [{
        to: request.to,
        data: request.data,
        value: request.value,
      }],
    })
  )
    .andThen(result => result)
    .mapErr(error => new TransactionSubmissionError(request, error))
}
```

## Retry Logic

If submission fails, the machine can retry:

```typescript
onError: [
  {
    guard: 'canRetry',  // retryCount < 3
    target: 'retrying',
    actions: [
      assign({
        error: ({ event }) => event.error as Error,
        retryCount: ({ context }) => context.retryCount + 1
      }),
      'logError',
    ]
  },
  {
    target: 'error.submission',  // Out of retries
  }
]
```

The `retrying` state waits for a delay, then returns to `submitting`.

## Code Location

**File**: `packages/transaction-manager/src/machines/transaction.machine.ts`

```typescript
submitting: {
  entry: ['recordTransition', ...],
  invoke: {
    src: 'submitTransaction',
    input: ({ context }) => ({ ... }),
    onDone: { target: 'pending', ... },
    onError: [ ... ]
  }
}
```

## Testing This State

```typescript
import { createActor } from 'xstate'
import { transactionMachine } from '@ens-apps/transaction-manager'

test('successful submission returns hash', async () => {
  const mockWalletClient = {
    sendTransaction: vi.fn().mockResolvedValue('0xhash123')
  }

  const actor = createActor(transactionMachine, {
    input: {
      intent: mockIntent,
      signer: { type: 'eoa', walletClient: mockWalletClient },
      request: mockRequest,
      publicClient: mockPublicClient,
    }
  })

  actor.start()

  await waitFor(() => {
    expect(actor.getSnapshot().value).toBe('pending')
    expect(actor.getSnapshot().context.hash).toBe('0xhash123')
  })
})

test('user rejection transitions to error', async () => {
  const mockWalletClient = {
    sendTransaction: vi.fn().mockRejectedValue(new Error('User rejected'))
  }

  const actor = createActor(transactionMachine, { ... })
  actor.start()

  await waitFor(() => {
    expect(actor.getSnapshot().value).toBe('error.submission')
    expect(actor.getSnapshot().context.error?.message).toContain('User rejected')
  })
})
```

## Common Questions

### Q: Why does submitting wait for the hash and not the receipt?

**A:** The hash is returned as soon as the transaction is broadcast to the network. Waiting for the receipt (mining) happens in the `pending` state. This separation allows us to:
- Show the transaction hash to users immediately
- Provide a link to block explorer while mining
- Handle mining timeouts separately from submission errors

### Q: What if the user never approves or rejects?

**A:** The machine will wait indefinitely in `submitting` state. You can add a timeout to the invoke if needed:

```typescript
invoke: {
  src: 'submitTransaction',
  timeout: 120000,  // 2 minutes
  onTimeout: {
    target: 'error.submission',
    actions: assign({
      error: () => new Error('Wallet approval timeout')
    })
  }
}
```

### Q: Can I cancel during submission?

**A:** Once the transaction is broadcast, it cannot be cancelled. However, you can send a replacement transaction with the same nonce and higher gas price to "cancel" it (actually replace it with a 0-value self-send).

## Related States

- **Previous State**: [preparing](./PREPARING.md) - Transaction preparation
- **Next State**: [pending](./PENDING.md) - Waiting for mining
- **Error State**: [error.submission](./ERROR_STATES.md#submission-error) - Submission failed
- **Retry State**: [retrying](./RETRYING.md) - Retry after failure

## Related Documentation

- [SIGNERS.md](../SIGNERS.md) - How different signers work
- [TRANSACTION_FLOW.md](../TRANSACTION_FLOW.md) - Complete transaction lifecycle
