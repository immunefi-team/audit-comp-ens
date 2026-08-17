# Signers

This document explains the Signer abstraction pattern used in the transaction manager and how transaction preparation and signing works.

## Overview

The transaction manager uses a **Signer abstraction** to decouple transaction orchestration from specific account implementations. This allows the same transaction manager to work with:

- EOA (Externally Owned Accounts) via WalletClient
- Rhinestone Smart Accounts
- ERC-4337 Account Abstraction
- Privy managed accounts
- Safe multisig accounts
- Any future signing method

## Core Principle

**The transaction manager receives UNSIGNED transactions and a reference to a signing capability (Signer), then orchestrates the signing process.**

```typescript
// React prepares transaction
const request = { to, data, value, ... } // UNSIGNED

// React creates signer (reference to signing capability)
const signer = { type: 'eoa', walletClient }

// React passes both to transaction manager
startTransaction(request, signer, options)
```

## Transaction Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. REACT COMPONENT                                      │
│    - Collects user input (form data)                    │
│    - Has access to walletClient & rhinestoneAccount    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 2. PREPARE TRANSACTION                                  │
│    prepareRenewalTransaction(formData, params)          │
│    • Calls contract read methods                        │
│    • Builds unsigned transaction request                │
│    • Returns: { request, options, modal }              │
│    • NO SIGNING happens here!                          │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 3. CREATE SIGNER                                        │
│    Based on user preference:                            │
│    • EOA: { type: 'eoa', walletClient }               │
│    • Rhinestone: { type: 'rhinestone', account, ... } │
│                                                         │
│    Signer = "capability to sign" (not the signature!)  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 4. START TRANSACTION                                    │
│    startTransaction(request, signer, options)           │
│    ├─ request: unsigned transaction data               │
│    ├─ signer: how to sign it                          │
│    └─ options: metadata (modal, description)          │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 5. TRANSACTION MANAGER                                  │
│    • Creates state machine actor                        │
│    • Routes based on signer.type                       │
│    • Calls appropriate transport actor                 │
└────────────────────┬────────────────────────────────────┘
                     │
            ┌────────┴────────┐
            ▼                 ▼
┌─────────────────┐  ┌──────────────────────┐
│ EOA TRANSPORT   │  │ RHINESTONE TRANSPORT │
│                 │  │                      │
│ walletClient    │  │ rhinestoneAccount    │
│ .sendTx()       │  │ .sendTx()            │
│                 │  │                      │
│ 👉 SIGNS HERE   │  │ 👉 SIGNS HERE        │
└─────────────────┘  └──────────────────────┘
        │                     │
        ▼                     ▼
   Wallet Popup          Smart Account
   User signs            Signing flow
```

## Signer Types

### Type Definition

```typescript
// src/types/signer.types.ts

export interface EOASigner {
  type: 'eoa'
  walletClient: WalletClient
}

export interface RhinestoneSigner {
  type: 'rhinestone'
  account: any // RhinestoneAccount from @rhinestone/sdk
  config: SmartAccountConfig
  // Note: publicClient is NOT in signer - it's in machine context
}

export interface ERC4337Signer {
  type: 'erc4337'
  // ... ERC-4337 specific fields
}

export type Signer =
  | EOASigner
  | RhinestoneSigner
  | ERC4337Signer
  | PrivySigner
  | SafeSigner
```

### Type Guards

```typescript
export function isEOASigner(signer: Signer): signer is EOASigner {
  return signer.type === 'eoa'
}

export function isRhinestoneSigner(signer: Signer): signer is RhinestoneSigner {
  return signer.type === 'rhinestone'
}
```

## Usage Examples

### Example 1: EOA Transaction

```typescript
import { prepareENSRenewal, type Signer } from '@ens-apps/transaction-manager'

// 1. Prepare the transaction (UNSIGNED)
const result = await prepareENSRenewal({
  publicClient,
  walletClient,
  name: 'leon',
  duration: 31536000n,
  chainId: 11155111,
  useSmartAccount: false,
})

if (result.isErr()) {
  console.error('Failed to prepare:', result.error)
  return
}

const { request, options } = result.value

// 2. Create EOA signer
const signer: Signer = {
  type: 'eoa',
  walletClient,
}

// 3. Start transaction (signing happens inside)
const txId = startTransaction(request, signer, options)
```

### Example 2: Rhinestone Smart Account Transaction

```typescript
// 1. Initialize Rhinestone account
const accountResult = await initializeRhinestoneAccount(
  walletClient,
  { chain: sepolia, rhinestoneApiKey }
)

if (accountResult.isErr()) return

const rhinestoneAccount = accountResult.value

// 2. Prepare the transaction (UNSIGNED)
const result = await prepareENSRenewal({
  publicClient,
  walletClient,
  name: 'leon',
  duration: 31536000n,
  chainId: 11155111,
  useSmartAccount: true,
  smartAccountConfig: { chain: sepolia },
})

if (result.isErr()) return

const { request, options } = result.value

// 3. Create Smart Account signer
const signer: Signer = {
  type: 'rhinestone',
  account: smartAccount,
  config: { chain: sepolia },
  // publicClient is pre-configured in transactionManager
}

// 4. Start transaction (signing happens inside)
const txId = startTransaction(request, signer, options)
```

### Example 3: Conditional Signer Creation

```typescript
// Helper function to create appropriate signer
function createSigner(
  useSmartAccount: boolean,
  walletClient: WalletClient,
  publicClient: PublicClient,
  smartAccount?: any,
  smartAccountConfig?: SmartAccountConfig
): Signer {
  if (useSmartAccount && smartAccount) {
    return {
      type: 'rhinestone',
      account: smartAccount,
      publicClient,
      config: smartAccountConfig!,
    }
  }

  return {
    type: 'eoa',
    walletClient,
  }
}

// Usage
const signer = createSigner(
  useSmartAccount,
  walletClient,
  publicClient,
  smartAccount,
  smartAccountConfig
)

startTransaction(request, signer, options)
```

## How Signing Actually Works

### EOA Flow (eoa-transport.actor.ts)

```typescript
export function submitEOATransaction(input: {
  request: TransactionRequest
  signer: EOASigner
}): ResultAsync<Hash, TransactionSubmissionError> {
  const { request, signer } = input
  const { walletClient } = signer
  const eoaRequest = request as EOATransactionRequest

  // Build transaction params (still UNSIGNED)
  const txParams = {
    account: eoaRequest.from,
    to: eoaRequest.to,
    value: eoaRequest.value,
    data: eoaRequest.data,
    gas: eoaRequest.gas,
    // ... other params
  }

  // Signing happens HERE when we call sendTransaction
  // 1. WalletClient prompts user's wallet (MetaMask, etc.)
  // 2. User approves in wallet popup
  // 3. Wallet signs with private key
  // 4. Signed transaction is broadcast to network
  return fromPromiseNT(
    walletClient.sendTransaction(txParams),
    (error) => new TransactionSubmissionError(eoaRequest, error)
  )
}
```

### Rhinestone Flow (rhinestone-transport.actor.ts)

```typescript
export function submitRhinestoneTransaction(input: {
  request: TransactionRequest
  signer: RhinestoneSigner
  publicClient: PublicClient
}): ResultAsync<Hash, TransactionSubmissionError> {
  const { request, signer, publicClient } = input
  const { account, config } = signer
  const rhinestoneRequest = request as RhinestoneTransactionRequest

  // Signing happens when we call rhinestoneAccount.sendTransaction
  // 1. Rhinestone SDK prepares smart account intent
  // 2. User signs the intent (via wallet popup)
  // 3. Intent is submitted to Rhinestone orchestrator
  // 4. Orchestrator executes the transaction
  return ResultAsync.fromSafePromise(
    executeENSRenewal(
      account,
      publicClient,
      rhinestoneRequest.rhinestoneParams,
      config
    )
  )
    .andThen(result => result)
    .mapErr(error => new TransactionSubmissionError(rhinestoneRequest, error))
}
```

## Key Points

### ✅ What the Signer IS:

- A **reference** to a signing capability (wallet, account)
- A **capability token** that grants access to signing operations
- A **type-safe wrapper** around different signing methods
- **Contains only what's needed to SIGN** (the account/wallet)
- **NOT responsible for reads** (publicClient is in machine context)

### ❌ What the Signer is NOT:

- NOT a pre-signed transaction
- NOT the signature itself
- NOT the private key
- NOT doing the signing (it delegates to wallet/account)

### Why This Pattern Works:

1. **Separation of Concerns**:
   - React prepares WHAT to sign (transaction request)
   - React provides HOW to sign (signer reference)
   - Transaction manager orchestrates WHEN to sign

2. **Type Safety**:
   - Compile-time checking of required fields
   - TypeScript ensures correct signer for each transaction type

3. **Extensibility**:
   - Add new account types by creating new Signer types
   - No changes needed to transaction manager core logic

4. **Testability**:
   - Mock signers for testing
   - No need to mock wallets or accounts

5. **Security**:
   - Private keys never leave the wallet
   - Signing happens in trusted environments (wallet extensions, hardware wallets)

## Migration from Old Pattern

### Before (Tightly Coupled)

```typescript
// Old: Transaction manager took wallet/account directly
startTransaction(
  request,
  {
    publicClient,
    walletClient,
    smartAccount,
    smartAccountConfig,
    // ... lots of optional parameters
  }
)

// Transaction manager had to know about all account types
if (request.type === 'eoa') {
  submitEOATransaction({ request, walletClient })
} else if (request.type === 'rhinestone-intent') {
  submitRhinestoneTransaction({ request, smartAccount, smartAccountConfig })
}
```

### After (Signer Abstraction)

```typescript
// New: Transaction manager takes a Signer
const signer: Signer = useSmartAccount
  ? { type: 'rhinestone', account: rhinestoneAccount, config }
  : { type: 'eoa', walletClient }

// publicClient is pre-configured in transactionManager
startTransaction(request, signer, options)

// Transaction manager routes by signer.type
switch (signer.type) {
  case 'eoa':
    return submitEOATransaction({ request, signer })
  case 'rhinestone':
    return submitRhinestoneTransaction({ request, signer, publicClient })
}
```

## Architecture Benefits

### Before

```
TransactionManager
├─ Knows about EOA
├─ Knows about Rhinestone
├─ Knows about Privy (future)
├─ Knows about Safe (future)
└─ Tightly coupled to all implementations
```

### After

```
TransactionManager
├─ Knows about Signer abstraction
├─ Routes by signer.type
└─ Delegates to transport actors

Transport Actors (pluggable)
├─ EOA Transport (eoa-transport.actor.ts)
├─ Rhinestone Transport (rhinestone-transport.actor.ts)
├─ ERC4337 Transport (future)
├─ Privy Transport (future)
└─ Safe Transport (future)
```

## File Structure

```
packages/transaction-manager/src/
├── types/
│   └── signer.types.ts          # Signer type definitions & guards
├── actors/
│   ├── eoa-transport.actor.ts   # EOA signing implementation
│   └── rhinestone-transport.actor.ts  # Rhinestone signing implementation
├── machines/
│   └── transaction.machine.ts   # Routes by signer.type
├── providers/
│   └── TransactionActorManagerProvider.tsx  # Provides startTransaction()
└── helpers/
    └── ens-renewal.helpers.ts   # Prepares unsigned transactions
```

## Related Documentation

- [Transaction Flow](./TRANSACTION_FLOW.md) - Complete transaction lifecycle
- [Signer Refactor Plan](./SIGNER_REFACTOR.md) - Migration details
- [neverthrow Guide](../../CLAUDE.md#neverthrow---functional-error-handling) - Error handling patterns

## FAQ

### Q: When does signing happen?

**A:** Signing happens when the transport actor calls `walletClient.sendTransaction()` or `rhinestoneAccount.sendTransaction()`. The transaction manager receives an unsigned request and passes it to the appropriate transport actor.

### Q: Can I create a custom signer?

**A:** Yes! Add a new type to the `Signer` union and create a corresponding transport actor:

```typescript
// 1. Add type
export interface CustomSigner {
  type: 'custom'
  customClient: CustomClient
}

export type Signer = EOASigner | RhinestoneSigner | CustomSigner

// 2. Create transport actor
export function submitCustomTransaction(input: {
  request: TransactionRequest
  signer: CustomSigner
}): ResultAsync<Hash, TransactionSubmissionError> {
  // Implementation
}

// 3. Add to transaction machine routing
switch (signer.type) {
  case 'eoa': return submitEOATransaction({ request, signer })
  case 'rhinestone': return submitRhinestoneTransaction({ request, signer, publicClient })
  case 'custom': return submitCustomTransaction({ request, signer })
}
```

### Q: Why not just pass walletClient directly?

**A:** The Signer abstraction provides:
- Type safety for different account types
- Explicit dependencies (config, publicClient, etc.)
- Clear contract between React and transaction manager
- Easy extensibility for new account types

### Q: What's the difference between request.type and signer.type?

**A:**
- `request.type`: What KIND of transaction (EOA, Rhinestone intent, ERC-4337 UserOp)
- `signer.type`: HOW to sign it (EOA wallet, Rhinestone account, etc.)

In practice, they're often related but conceptually separate concerns.

### Q: Do I need to prepare transactions differently for different signers?

**A:** Yes, some preparation is signer-specific:
- EOA: Standard transaction with gas estimation
- Rhinestone: Intent with rhinestoneParams
- ERC-4337: UserOperation construction

The `prepareENSRenewal()` helper handles this based on the `useSmartAccount` flag.
