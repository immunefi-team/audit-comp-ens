# Transaction Preparation

## Overview

Every transaction goes through a **preparation phase** before being submitted to the blockchain. This document explains why preparation is necessary and what happens during this phase.

## Why Preparation is Necessary

### 1. Dynamic Transaction Data

Some transactions require reading current blockchain state to construct the transaction:

**ENS Renewal Example:**
```typescript
// The renewal price can change between page load and submission
const currentPrice = await contract.rentPrice(name, duration)

// Must get fresh price right before submission
const transaction = {
  to: ENS_CONTROLLER,
  data: encodeFunctionData({ functionName: 'renew', args: [name, duration] }),
  value: currentPrice,  // ← Must be current, not cached!
}
```

**Why?** The renewal price includes a premium that decays over time. If we use a stale price, the transaction will fail.

### 2. Gas Estimation

All transactions need gas estimation to:
- Calculate total cost for user display
- Set gas limits (required for smart accounts)
- Prevent failed transactions due to insufficient gas

```typescript
// Gas estimation requires the full transaction data
const gasEstimate = await publicClient.estimateGas({
  to: transaction.to,
  data: transaction.data,
  value: transaction.value,
  account: from,
})

const gasPrice = await publicClient.getGasPrice()
const gasCost = gasEstimate * gasPrice
const totalCost = transaction.value + gasCost
```

**Why?** Users need to know the total cost (value + gas) before approving the transaction.

### 3. Calldata Encoding

Contract function calls must be encoded into the `data` field:

```typescript
// Human-readable intent
const intent = {
  type: 'ens-renewal',
  name: 'leon',
  duration: 31536000n,
}

// Must be encoded for blockchain
const data = encodeFunctionData({
  abi: ETH_REGISTRAR_CONTROLLER_ABI,
  functionName: 'renew',
  args: [intent.name, intent.duration],
})
```

**Why?** The blockchain only understands raw calldata, not high-level intents.

### 4. Smart Account Complexity

Smart accounts (Rhinestone, Safe, ERC-4337) have additional preparation requirements:

- **Gas limits** - Must specify `callGasLimit`, `verificationGasLimit`, etc.
- **Paymaster data** - If using gasless transactions
- **Batch calls** - Multiple operations in one transaction
- **Cross-chain routing** - Determining optimal execution path

**Why?** These can't be determined without preparing the full transaction first.

## What Happens During Preparation

The `preparing` state in the transaction machine performs these steps:

### For ENS Renewal:
```typescript
1. Read blockchain state
   ├─ Get current renewal price from contract
   └─ Check name availability (optional)

2. Encode transaction data
   ├─ Encode renew(name, duration) function call
   └─ Create calldata

3. Estimate gas (future)
   ├─ Estimate gas for the transaction
   └─ Get current gas price

4. Calculate total cost (future)
   └─ totalCost = renewalPrice + (gasEstimate × gasPrice)

Output: TransactionRequest ready for signing
```

### For ETH Transfer:
```typescript
1. Validate inputs
   └─ Ensure valid address and amount

2. Estimate gas (future)
   ├─ Estimate gas (usually 21000 for simple transfer)
   └─ Get current gas price

3. Calculate total cost (future)
   └─ totalCost = transferAmount + (21000 × gasPrice)

Output: TransactionRequest ready for signing
```

### For Arbitrary Contract Call:
```typescript
1. Validate inputs
   └─ Data already provided by user

2. Estimate gas (future)
   ├─ Estimate gas for the specific call
   └─ Get current gas price

3. Calculate total cost (future)
   └─ totalCost = value + (gasEstimate × gasPrice)

Output: TransactionRequest ready for signing
```

## Machine States

```
┌─────────────────────────────────────────────────────────────┐
│                     Transaction Flow                         │
└─────────────────────────────────────────────────────────────┘

idle
  │
  │ User provides TransactionIntent
  │
  ▼
preparing ◄────────────────────────┐
  │                                 │
  │ • Read blockchain state         │ Retry on
  │ • Encode calldata               │ failure
  │ • Estimate gas                  │
  │ • Calculate total cost          │
  │                                 │
  ├─ onDone ────────────────────────┘
  │
  ▼
submitting
  │
  │ • Get nonce (EOA)
  │ • Sign transaction
  │ • Send to network
  │
  ▼
pending
  │
  │ • Wait for confirmation
  │
  ▼
success
```

## Why Not Prepare Earlier?

You might ask: "Why not prepare the transaction when the user fills out the form?"

### Problems with Early Preparation:

1. **Stale Data**
   ```typescript
   // User fills form at 10:00:00
   const price1 = await getPrice() // 0.001 ETH

   // User clicks submit at 10:05:00
   const price2 = await getPrice() // 0.0015 ETH (price changed!)

   // If we use price1, transaction fails!
   ```

2. **Wasted RPC Calls**
   - User might never submit
   - User might change inputs multiple times
   - Each preparation requires RPC calls (costs time/money)

3. **Nonce Issues**
   - Nonce must be fetched just before submission
   - If user has multiple tabs, nonce can become stale

### Solution: Separate Simulation from Preparation

For live price display, use **simulation** (separate from preparation):

```typescript
// Simulation - runs as user types (cached, can be stale)
const { data: simulation } = useSimulateENSRenewal({
  name,
  duration,
  refetchInterval: 15000,  // Update every 15s
})

// Show user estimated cost
<div>Estimated: {simulation.totalCost}</div>

// Preparation - runs when user commits (fresh, accurate)
const txId = transactionManager.startTransaction(intent, signer)
// Machine enters 'preparing' state and gets fresh data
```

## Current Implementation Status

### ✅ Implemented:
- Read blockchain state (renewal price)
- Encode calldata
- Route based on intent type
- Error handling for preparation failures

### 🚧 TODO:
- Gas estimation for all transaction types
- Gas price fetching
- Total cost calculation (value + gas)
- Preparation retry logic
- Preparation timeout handling

## Future: Simulation Service

For the best UX, we should add a separate simulation service:

```typescript
// Lightweight simulation for live feedback
const { estimatedCost, willSucceed } = useSimulateTransaction({
  intent,
  enabled: formIsValid,
  refetchInterval: 15000,
})

// Show live feedback
{willSucceed ? '✅ Will succeed' : '❌ Will fail'}
{estimatedCost && `Cost: ${formatEther(estimatedCost)} ETH`}

// Actual preparation happens in machine when user commits
<button onClick={() => transactionManager.startTransaction(intent, signer)}>
  Submit
</button>
```

See `SIMULATION.md` for full simulation architecture (TODO).

## Related Documentation

- [Transaction Flow](./TRANSACTION_FLOW.md) - Complete transaction lifecycle
- [Signers](./SIGNERS.md) - How different account types work
- [Intent System](./INTENTS.md) - High-level transaction descriptions (TODO)
