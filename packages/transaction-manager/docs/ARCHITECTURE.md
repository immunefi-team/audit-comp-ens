# Architecture Overview

**Last Updated**: 2025-10-26

This document provides an up-to-date overview of the transaction manager architecture as currently implemented.

## Core Architecture

### 1. Intent-Based Transaction System

Users describe **what** they want to do (intent), not **how** to do it (prepared transaction).

```typescript
// Create a transaction intent
const intent: ENSRenewalTransactionIntent = {
  type: 'ens-renewal',
  name: 'leon',
  duration: 31536000n,  // 1 year in seconds
  from: '0x...',
}

// Create a signer (how to sign)
const signer: EOASigner = {
  type: 'eoa',
  walletClient,
}

// Start the transaction
const txId = transactionManager.startTransaction(intent, signer, {
  chainId: sepolia.id,
  useSmartAccount: false,
})
```

### 2. Transaction Manager Singleton

A module-level singleton that manages all transactions:

```typescript
import { transactionManager } from '@ens-apps/transaction-manager'

// Pre-configure public client (optional, per chain)
transactionManager.setPublicClient(sepolia.id, publicClient)

// Start transaction (publicClient retrieved from storage)
const txId = transactionManager.startTransaction(intent, signer, { chainId: sepolia.id })

// Get transaction actor
const actor = transactionManager.getTransaction(txId)

// Cancel transaction
transactionManager.cancelTransaction(txId)
```

**SSR Safe**: PublicClients are stored per-chain (no user-specific data). Each transaction gets its own isolated actor.

### 3. Transaction Flow

The transaction progresses through these states:

```
idle → preparing → submitting → pending → confirming → success
```

For detailed state flow diagrams and descriptions, see:
- [transactionStates/README.md](./transactionStates/README.md) - Complete state flow overview
- [TRANSACTION_FLOW.md](./TRANSACTION_FLOW.md) - End-to-end transaction lifecycle

## Key Components

### Transaction Intents

High-level descriptions of what the user wants to do:

```typescript
// ENS Renewal
export interface ENSRenewalTransactionIntent {
  type: 'ens-renewal'
  name: string          // ENS name without .eth
  duration: bigint      // Duration in seconds
  from: Hex             // Account address
}

// ETH Transfer
export interface ETHTransferTransactionIntent {
  type: 'eth-transfer'
  to: Hex
  value: bigint
  from: Hex
  data?: Hex
}

// Custom (escape hatch)
export interface CustomTransactionIntent {
  type: 'custom'
  request: TransactionRequest  // Pre-prepared transaction
}

export type TransactionIntent =
  | ENSRenewalTransactionIntent
  | ETHTransferTransactionIntent
  | CustomTransactionIntent
```

**Note**: These are **TransactionIntents** (for our transaction manager), distinct from **Rhinestone Intents** (for chain abstraction).

### Signers

Represent the capability to sign transactions:

```typescript
// EOA Signer
export interface EOASigner {
  type: 'eoa'
  walletClient: WalletClient
}

// Rhinestone Signer
export interface RhinestoneSigner {
  type: 'rhinestone'
  account: any  // RhinestoneAccount from @rhinestone/sdk
  config: SmartAccountConfig
}

export type Signer = EOASigner | RhinestoneSigner | ...
```

**Key Principle**: Signers contain only what's needed to **sign** (the account), not to **read** (publicClient is in machine context).

### Transaction Requests

Low-level blockchain transaction data (output of preparation):

```typescript
// EOA Transaction
export interface EOATransactionRequest {
  type: 'eoa'
  from: Address
  to: Address
  value?: bigint
  data?: Hex
  chainId: number
  gas?: bigint
  gasPrice?: bigint
  // ...
}

// Rhinestone Transaction
export interface RhinestoneTransactionRequest {
  type: 'rhinestone-intent'
  from: Address
  to: Address
  value?: bigint
  data?: Hex
  chainId: number
  rhinestoneParams?: {
    name: string
    duration: bigint
  }
}

export type TransactionRequest =
  | EOATransactionRequest
  | RhinestoneTransactionRequest
  | ERC4337UserOperation
```

## File Structure

```
packages/transaction-manager/
├── src/
│   ├── types/
│   │   ├── transaction.types.ts    # Intents, Requests, Options
│   │   ├── signer.types.ts         # Signer abstraction
│   │   └── audit.types.ts          # Audit trail types
│   │
│   ├── actors/
│   │   ├── prepare-transaction.actor.ts    # Routes intent → request
│   │   ├── eoa-transport.actor.ts          # EOA submission
│   │   └── rhinestone-transport.actor.ts   # Rhinestone submission
│   │
│   ├── machines/
│   │   └── transaction.machine.ts   # Main state machine
│   │
│   ├── services/
│   │   ├── transactionManager.ts    # Singleton manager
│   │   └── audit-trail.service.ts   # Logging/debugging
│   │
│   ├── helpers/
│   │   ├── ens-renewal.helpers.ts           # ENS-specific logic
│   │   └── rhinestone-account.helpers.ts    # Rhinestone utilities
│   │
│   └── index.ts  # Public API exports
│
├── docs/
│   ├── README.md                    # Documentation index
│   ├── ARCHITECTURE.md      # This file
│   ├── PREPARATION.md               # Why preparation is needed
│   ├── SIGNERS.md       # Signer abstraction
│   ├── SIGNER_REFACTOR.md          # Migration history
│   └── TRANSACTION_FLOW.md         # Detailed flow (needs update)
│
└── package.json
```

## Current State vs Future Plans

### ✅ Currently Implemented

- Intent-based API (ENS renewal, ETH transfer, custom)
- Signer abstraction (EOA, Rhinestone)
- Transaction manager singleton
- Public client storage (per-chain)
- State machine with preparing state
- Preparation actor (routes by intent type)
- Transport actors (EOA, Rhinestone)
- Type-safe discriminated unions
- neverthrow error handling
- XState + neverthrow integration (fromResultAsync)

### 🚧 In Progress / Partial

- **Gas estimation** - Not yet implemented in preparation
- **Total cost calculation** - Currently only shows renewal price, not gas
- **Ready state** - No user confirmation step before submission
- **Auto-refresh** - No price refresh in ready state
- **Cleanup strategies** - No automatic actor cleanup
- **Preparation retry** - No retry logic for failed preparation

### 📝 Future / Planned

- **Simulation service** - Live cost estimation as user types
- **Safe multisig support** - Safe signer + transport actor
- **ERC-4337 support** - UserOp bundler integration
- **Multi-chain transactions** - Cross-chain intent execution
- **Transaction batching** - Multiple operations in one transaction
- **Gasless transactions** - Paymaster integration
- **Transaction queueing** - Sequential execution of dependent transactions

## Usage Example

For complete examples with full component code, see:
- [README.md](./README.md#quick-start) - Quick start guide
- [TRANSACTION_FLOW.md](./TRANSACTION_FLOW.md#complete-example) - Complete transaction flow example

## Design Principles

### 1. Intent Over Implementation

Users describe **what**, not **how**:

```typescript
// ❌ Old: Manual preparation
const price = await getPrice(name, duration)
const data = encodeFunctionData(...)
const request = { to, data, value: price }

// ✅ New: Intent-based
const intent = { type: 'ens-renewal', name, duration, from }
```

### 2. Separation of Concerns

- **Intent** = What the user wants
- **Preparation** = How to construct the transaction
- **Signer** = How to authorize the transaction
- **Submission** = How to send to blockchain
- **Confirmation** = How to verify completion

### 3. Pure Functions + State Machines

- Business logic in **pure functions** (testable, reusable)
- State management in **XState machines** (auditable, explicit)
- Never mix state in service classes

### 4. Type Safety

- Discriminated unions everywhere
- TypeScript catches invalid combinations at compile time
- Runtime safety via pattern matching (ts-pattern)

### 5. Error Handling

- Never use try-catch for business logic
- Always return `Result` or `ResultAsync` from neverthrow
- Use `fromResultAsync` to integrate with XState

## Related Documentation

- [README.md](./README.md) - Documentation index and quick start
- [TRANSACTION_FLOW.md](./TRANSACTION_FLOW.md) - Complete transaction lifecycle
- [SIGNERS.md](./SIGNERS.md) - Signer abstraction details
- [SIGNER_REFACTOR.md](./SIGNER_REFACTOR.md) - Historical refactoring notes

### Transaction States Documentation

For detailed information about each state in the transaction flow:

- [transactionStates/README.md](./transactionStates/README.md) - Overview of all states
- [transactionStates/IDLE.md](./transactionStates/IDLE.md) - Initial state
- [transactionStates/PREPARING.md](./transactionStates/PREPARING.md) - Transaction preparation
- [transactionStates/SUBMITTING.md](./transactionStates/SUBMITTING.md) - Signing and broadcasting
- [transactionStates/PENDING.md](./transactionStates/PENDING.md) - Waiting for mining
- [transactionStates/CONFIRMING.md](./transactionStates/CONFIRMING.md) - Verifying result
- [transactionStates/SUCCESS.md](./transactionStates/SUCCESS.md) - Successful completion
