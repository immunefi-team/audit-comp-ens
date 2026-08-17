# @ens-apps/transaction-manager - Package Vision

## Core Premise

**This is the ENS Transaction Manager** - a package purpose-built for ENS operations across all ENS apps.

It's not:
- ❌ A generic transaction manager with ENS features
- ❌ A blockchain transaction library
- ❌ A universal wallet abstraction

It is:
- ✅ **The** centralized transaction orchestration system for ENS apps
- ✅ Purpose-built for ENS operations (register, renew, transfer, etc.)
- ✅ Shared infrastructure for `apps/manager` and `apps/portal`

---

## Package Philosophy

### 1. ENS-First Design

Everything in this package should be designed with ENS use cases in mind:

```typescript
// ✅ Good - ENS-focused
import {
  useENSRegistration,
  useENSRenewal,
  useENSTransfer
} from '@ens-apps/transaction-manager'

// ❌ Bad - trying to be generic
import {
  useTransaction,  // Too generic - what transaction?
  TransactionManager // Too abstract
} from '@ens-apps/transaction-manager'
```

### 2. Transaction Types = ENS Operations

The transaction types should map to ENS operations:

```typescript
type ENSOperation =
  | 'registration'
  | 'renewal'
  | 'transfer'
  | 'update-records'
  | 'set-resolver'
  | 'unwrap'
  | 'wrap'
```

Not generic blockchain operations.

### 3. Shared Infrastructure, Not Generic Infrastructure

The "generic" parts exist **to support ENS operations**, not as standalone features:

```typescript
// These exist to support ENS operations
- Transaction machine (handles tx lifecycle for ENS operations)
- Signer abstraction (EOA, Rhinestone - for ENS users)
- Persistence (recovers ENS operations)
- Audit trail (debugs ENS flows)
```

They're reusable **within the ENS context**, not designed for external use.

---

## Proposed Package Structure (Revised)

```
packages/transaction-manager/src/
├── index.ts                           Main exports
│
├── types/
│   ├── operations.types.ts            ENS operation types
│   ├── signers.types.ts               Signer abstraction
│   └── transactions.types.ts          Transaction types
│
├── machines/
│   ├── transaction.machine.ts         Generic tx lifecycle (used by all operations)
│   ├── registration.machine.ts        Registration orchestration
│   ├── renewal.machine.ts             Renewal orchestration
│   ├── transfer.machine.ts            Transfer orchestration
│   └── records.machine.ts             Update records orchestration
│
├── actors/
│   ├── transaction/                   Transaction-level actors
│   │   ├── eoa-submission.actor.ts
│   │   └── rhinestone-submission.actor.ts
│   ├── registration/                  Registration-specific actors
│   │   ├── commitment.actor.ts
│   │   ├── approval.actor.ts
│   │   └── registration.actor.ts
│   ├── renewal/                       Renewal-specific actors
│   │   └── renewal.actor.ts
│   └── transfer/                      Transfer-specific actors
│       └── transfer.actor.ts
│
├── hooks/
│   ├── useENSRegistration.ts          Registration hook
│   ├── useENSRenewal.ts               Renewal hook
│   ├── useENSTransfer.ts              Transfer hook
│   ├── useTransaction.ts              Low-level tx hook (internal)
│   └── useActiveOperations.ts         Track all active ENS operations
│
├── components/
│   ├── RegistrationFlow/              Pre-built registration UI
│   ├── RenewalFlow/                   Pre-built renewal UI
│   ├── TransferFlow/                  Pre-built transfer UI
│   └── TransactionStatus/             Generic status UI
│
├── helpers/
│   ├── ens-contracts.ts               ENS contract addresses/ABIs
│   ├── registration.helpers.ts        Registration utilities
│   ├── renewal.helpers.ts             Renewal utilities
│   ├── pricing.helpers.ts             ENS pricing calculations
│   └── rhinestone.helpers.ts          Rhinestone account utilities
│
├── services/
│   ├── transactionManager.ts          Central operation manager
│   ├── persistence.service.ts         IndexedDB persistence
│   └── audit.service.ts               Audit trail
│
└── errors/
    ├── registration.errors.ts         Registration-specific errors
    ├── renewal.errors.ts              Renewal-specific errors
    └── transaction.errors.ts          Generic transaction errors
```

---

## Mental Model: "ENS Operations Manager"

Think of this package as managing **ENS operations**, not abstract transactions:

### ✅ Clear Mental Model

```typescript
import { transactionManager } from '@ens-apps/transaction-manager'

// Start an ENS operation (not a "transaction")
const operationId = transactionManager.startRegistration({
  name: 'leon',
  duration: 31536000n,
  signer: rhinestoneSigner
})

const operationId2 = transactionManager.startRenewal({
  name: 'vitalik',
  duration: 31536000n,
  signer: eoaSigner
})

// Get all active ENS operations
const operations = transactionManager.getActiveOperations()
// [
//   { id: '1', type: 'registration', name: 'leon', state: 'committing' },
//   { id: '2', type: 'renewal', name: 'vitalik', state: 'pending' }
// ]
```

### ❌ Confusing Mental Model (Old)

```typescript
// Too abstract - what transaction? For what?
const txId = transactionManager.startTransaction(intent, signer)
```

---

## Package Exports (ENS-Focused)

```typescript
// packages/transaction-manager/src/index.ts

// === ENS Operations ===
export { transactionManager } from './services/transactionManager'

// Registration
export { registrationMachine } from './machines/registration.machine'
export { useENSRegistration } from './hooks/useENSRegistration'

// Renewal
export { renewalMachine } from './machines/renewal.machine'
export { useENSRenewal } from './hooks/useENSRenewal'

// Transfer
export { transferMachine } from './machines/transfer.machine'
export { useENSTransfer } from './hooks/useENSTransfer'

// Records
export { recordsMachine } from './machines/records.machine'
export { useENSRecords } from './hooks/useENSRecords'

// === Tracking & Monitoring ===
export { useActiveOperations } from './hooks/useActiveOperations'
export { useOperationHistory } from './hooks/useOperationHistory'

// === Components ===
export { RegistrationFlow } from './components/RegistrationFlow'
export { RenewalFlow } from './components/RenewalFlow'
export { TransferFlow } from './components/TransferFlow'
export { OperationStatusPanel } from './components/OperationStatusPanel'

// === Helpers ===
export { getENSPrice } from './helpers/pricing.helpers'
export { initializeRhinestoneAccount } from './helpers/rhinestone.helpers'

// === Types ===
export type {
  ENSOperation,
  RegistrationParams,
  RenewalParams,
  TransferParams,
  Signer
} from './types'
```

---

## Usage in Apps (Simplified)

### Manager App

```typescript
// apps/manager/src/features/register/RegistrationPage.tsx

import { useENSRegistration } from '@ens-apps/transaction-manager'

export function RegistrationPage({ name }: { name: string }) {
  const { state, startRegistration } = useENSRegistration({
    rhinestoneAccount,
    chainId: sepolia.id
  })

  const handleStart = (params: { duration: bigint; token: 'USDC' | 'DAI' }) => {
    startRegistration({
      name,
      duration: params.duration,
      token: params.token
    })
  }

  return <div>...</div>
}
```

### Portal App

```typescript
// apps/portal/src/features/renew/RenewalPage.tsx

import { useENSRenewal } from '@ens-apps/transaction-manager'

export function RenewalPage({ name }: { name: string }) {
  const { state, startRenewal } = useENSRenewal({
    rhinestoneAccount,
    chainId: sepolia.id
  })

  const handleRenew = (duration: bigint) => {
    startRenewal({ name, duration })
  }

  return <div>...</div>
}
```

---

## Implementation Priorities

### Phase 1: Registration (Current Focus)
- ✅ Registration orchestration machine
- ✅ useENSRegistration hook
- ✅ Registration actors
- ✅ Persistence and recovery

### Phase 2: Renewal
- 🔄 Renewal orchestration machine
- 🔄 useENSRenewal hook
- 🔄 Renewal actors

### Phase 3: Transfer
- ⏳ Transfer orchestration machine
- ⏳ useENSTransfer hook
- ⏳ Transfer actors

### Phase 4: Other Operations
- ⏳ Update records
- ⏳ Set resolver
- ⏳ Wrap/unwrap

---

## Transaction Manager API (ENS-Focused)

```typescript
// services/transactionManager.ts

class ENSTransactionManager {
  // Registration
  startRegistration(params: RegistrationParams): string
  getRegistration(id: string): RegistrationActor

  // Renewal
  startRenewal(params: RenewalParams): string
  getRenewal(id: string): RenewalActor

  // Transfer
  startTransfer(params: TransferParams): string
  getTransfer(id: string): TransferActor

  // Monitoring
  getActiveOperations(): ENSOperation[]
  getOperationHistory(): ENSOperation[]
  cancelOperation(id: string): void

  // Recovery
  recoverPendingOperations(): ENSOperation[]
}

export const transactionManager = new ENSTransactionManager()
```

---

## Documentation Structure

```
packages/transaction-manager/
├── README.md                    "ENS Transaction Manager"
├── docs/
│   ├── REGISTRATION.md          How to use registration
│   ├── RENEWAL.md               How to use renewal
│   ├── TRANSFER.md              How to use transfer
│   ├── PERSISTENCE.md           How persistence works
│   └── ARCHITECTURE.md          Package architecture
└── examples/
    ├── registration.example.tsx
    ├── renewal.example.tsx
    └── transfer.example.tsx
```

---

## Benefits of "ENS Transaction Manager" Framing

### 1. **Clarity**
Developers immediately understand what this package does:
- "ENS Transaction Manager" → handles ENS operations
- Not: "Transaction Manager" → handles... what transactions?

### 2. **Scope**
Clear boundaries on what belongs in this package:
- ✅ ENS registration → Yes
- ✅ ENS renewal → Yes
- ❌ Generic ETH transfer → No
- ❌ ERC20 token swap → No

### 3. **Discoverability**
Easier to find the right hook/component:
```typescript
// Clear and discoverable
import { useENSRegistration } from '@ens-apps/transaction-manager'

// vs unclear
import { useTransaction } from '@ens-apps/transaction-manager'
// What transaction? How do I register?
```

### 4. **Maintenance**
Easier to evolve - all ENS operations belong here:
- Adding ENS renewal → obvious fit
- Adding ENS transfer → obvious fit
- Adding generic blockchain stuff → doesn't belong

---

## README Introduction (Proposed)

```markdown
# @ens-apps/transaction-manager

**The centralized transaction orchestration system for ENS operations.**

This package provides type-safe, XState-powered orchestration for all ENS operations across ENS apps (manager, portal). It handles:

- ✅ ENS registration (commit-reveal flow)
- ✅ ENS renewal
- ✅ ENS transfer
- ✅ Record updates
- ✅ Smart account integration (Rhinestone)
- ✅ Automatic persistence and recovery
- ✅ Complete audit trail

## Quick Start

### Registration

\`\`\`typescript
import { useENSRegistration } from '@ens-apps/transaction-manager'

function RegisterPage({ name }) {
  const { state, startRegistration } = useENSRegistration({
    rhinestoneAccount,
    chainId: sepolia.id
  })

  const handleRegister = () => {
    startRegistration({
      name: 'leon',
      duration: 31536000n, // 1 year
      token: 'USDC'
    })
  }

  return <div>Current step: {state.value}</div>
}
\`\`\`

### Renewal

\`\`\`typescript
import { useENSRenewal } from '@ens-apps/transaction-manager'

function RenewPage({ name }) {
  const { state, startRenewal } = useENSRenewal({
    rhinestoneAccount,
    chainId: sepolia.id
  })

  // Similar API
}
\`\`\`

## Features

- 🎯 **ENS-specific** - Built for ENS operations
- 🔄 **Multi-step flows** - Registration, renewal, transfer
- 💾 **Persistent** - Survives page refresh
- 🔍 **Auditable** - Complete state transition logs
- 🧪 **Testable** - Pure actor functions
- 📱 **Universal** - Works in manager, portal, or any ENS app

## Architecture

All ENS operations follow the same pattern:
1. User initiates operation
2. XState machine orchestrates flow
3. Transaction manager handles individual transactions
4. State is persisted and auditable
5. Apps get real-time updates

See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for details.
\`\`\`

---

## Key Insight

By framing this as the **"ENS Transaction Manager"**, we:

1. ✅ Acknowledge it's purpose-built for ENS
2. ✅ Set clear scope boundaries
3. ✅ Make the API more intuitive
4. ✅ Simplify decision-making (does this ENS operation belong here? Yes!)
5. ✅ Align with reality (both apps are ENS-focused)

This isn't a generic package trying to be everything. It's **THE** package for ENS transaction orchestration. 🎯

---

**Last Updated**: 2025-11-07
**Status**: Vision Document
