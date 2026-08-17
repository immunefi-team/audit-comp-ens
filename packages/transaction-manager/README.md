# @ens-apps/transaction-manager

A robust transaction management library for ENS applications with support for EOA, ERC-4337, audit trails, and multi-step flows.

## Features

- ✅ **Multiple Transaction Types**: EOA, ERC-4337 (Account Abstraction)
- ✅ **Audit Trail**: Complete state transition history with debugging capabilities
- ✅ **Error Recovery**: Automatic retries, eth_call fallback detection
- ✅ **State Persistence**: Survive page refreshes
- ✅ **XState Integration**: Predictable state management
- ✅ **TypeScript**: Full type safety with neverthrow error handling
- ✅ **React Hooks**: Easy integration with React applications

## Installation

```bash
pnpm add @ens-apps/transaction-manager
```

## Quick Start

### Basic EOA Transaction

```tsx
import { useMachine } from '@xstate/react'
import { usePublicClient, useWalletClient } from 'wagmi'
import { transactionMachine, TransactionService } from '@ens-apps/transaction-manager'

function SendButton() {
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  const [state, send] = useMachine(transactionMachine, {
    input: {
      transactionService: new TransactionService(publicClient!, walletClient)
    }
  })

  const handleSend = () => {
    send({
      type: 'EXECUTE',
      request: {
        type: 'eoa',
        from: '0x...',
        to: '0x...',
        value: BigInt(1e18), // 1 ETH
        chainId: 1
      }
    })
  }

  const isLoading = state.matches('preparing') || state.matches('submitting')
  const isPending = state.matches('pending') || state.matches('confirming')
  const isSuccess = state.matches('success')

  return (
    <button onClick={handleSend} disabled={isLoading || isPending}>
      {isLoading ? 'Preparing...' :
       isPending ? 'Waiting...' :
       isSuccess ? `Success: ${state.context.hash}` :
       'Send ETH'}
    </button>
  )
}
```

### ERC-4337 User Operation

```tsx
import { useMachine } from '@xstate/react'
import { usePublicClient, useWalletClient } from 'wagmi'
import { transactionMachine, TransactionService } from '@ens-apps/transaction-manager'

function SmartAccountButton() {
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  const [state, send] = useMachine(transactionMachine, {
    input: {
      transactionService: new TransactionService(publicClient!, walletClient)
    }
  })

  const handleSend = () => {
    send({
      type: 'EXECUTE',
      request: {
        type: 'erc4337',
        from: '0x...', // Smart account address
        to: '0x...',
        callData: '0x...',
        callGasLimit: BigInt(100000),
        verificationGasLimit: BigInt(100000),
        preVerificationGas: BigInt(50000),
        maxFeePerGas: BigInt(20e9),
        maxPriorityFeePerGas: BigInt(2e9),
        entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
        chainId: 1
      }
    })
  }

  return <button onClick={handleSend}>Send via Smart Account</button>
}
```

### Audit Trail & Debugging

```tsx
import { useAuditTrail } from '@ens-apps/transaction-manager'

function DebugDashboard() {
  const {
    getDebugReport,
    exportAudit,
    getTransitionHistory
  } = useAuditTrail()

  const handleExportDebug = () => {
    const report = getDebugReport()
    console.log('Debug Report:', report)
    exportAudit() // Downloads JSON file
  }

  const viewHistory = () => {
    const history = getTransitionHistory({
      fromTime: Date.now() - 3600000, // Last hour
      includeErrors: true
    })
    console.log('Transaction History:', history)
  }

  return (
    <div>
      <button onClick={handleExportDebug}>Export Debug Report</button>
      <button onClick={viewHistory}>View History</button>
    </div>
  )
}
```

### ENS Renewal with Helpers

```tsx
import { useMachine } from '@xstate/react'
import { usePublicClient, useWalletClient } from 'wagmi'
import {
  transactionMachine,
  TransactionService,
  prepareENSRenewal,
  getENSRenewalPrice,
  getRhinestoneSmartAccountAddress
} from '@ens-apps/transaction-manager'
import { sepolia } from 'viem/chains'

function ENSRenewal() {
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  const [state, send] = useMachine(transactionMachine, {
    input: {
      transactionService: new TransactionService(publicClient!, walletClient)
    }
  })

  // Get renewal price using helper
  const [price, setPrice] = useState<bigint | null>(null)

  useEffect(() => {
    async function fetchPrice() {
      const result = await getENSRenewalPrice(publicClient!, 'vitalik', 31536000n)
      if (result.isOk()) setPrice(result.value)
    }
    fetchPrice()
  }, [publicClient])

  // Execute renewal
  const handleRenew = async () => {
    const result = await prepareENSRenewal({
      publicClient: publicClient!,
      walletClient: walletClient!,
      name: 'vitalik',
      duration: 31536000n,
      chainId: sepolia.id,
      useSmartAccount: true,
      rhinestoneConfig: { /* ... */ }
    })

    if (result.isOk()) {
      send({
        type: 'EXECUTE',
        request: result.value.request,
        options: result.value.options
      })
    }
  }

  return (
    <button onClick={handleRenew} disabled={state.matches('pending')}>
      Renew for {price ? formatEther(price) : '...'} ETH
    </button>
  )
}
```

## Transaction States

The transaction machine follows these states:

```
idle → preparing → submitting → pending → confirming → success
          ↓          ↓          ↓
        error    fallback    reverted
                ↑          ↓
              retry    success
```

### State Descriptions

- **preparing**: Initial state, preparing transaction
- **submitting**: Sending transaction to network
- **pending**: Transaction sent, waiting for confirmation
- **checkingFallback**: Using eth_call to detect completion (commit/reveal pattern)
- **confirming**: Transaction mined, checking status
- **success**: Transaction completed successfully
- **error**: Transaction failed (with substates: submission, timeout, reverted, cancelled)
- **retrying**: Automatic retry after failure

## Advanced Usage

### Transaction Options

```typescript
execute(request, {
  confirmations: 2,        // Wait for 2 confirmations
  timeout: 60000,         // 60 second timeout
  retryCount: 3,          // Retry up to 3 times
  retryDelay: 2000,       // Wait 2 seconds between retries
  usePrivateMempool: true // Use Flashbots Protect
})
```

### Error Handling

All errors use `neverthrow` for type-safe error handling:

```typescript
import { TransactionService } from '@ens-apps/transaction-manager'

const service = new TransactionService(publicClient, walletClient)

const result = await service.submitTransaction(request)

if (result.isErr()) {
  switch (result.error.name) {
    case 'TransactionSubmissionError':
      // Handle submission error
      break
    case 'UserOperationError':
      // Handle 4337 error
      break
  }
}
```

### Debug Reports

Debug reports include:

- **State Transitions**: Complete history of state changes
- **Audit Log**: Info, warning, error, and critical events
- **Error Summary**: Error types and frequencies
- **Performance Metrics**: Transition timing statistics
- **State Distribution**: Time spent in each state

```typescript
const report = getDebugReport('0xtransactionHash')

console.log(report.errorSummary)
// {
//   totalErrors: 2,
//   errorRate: 15.5,
//   errorTypes: { 'NetworkError': 1, 'RevertError': 1 },
//   lastError: Error
// }

console.log(report.performanceMetrics)
// {
//   avgTransitionTime: 1250,
//   maxTransitionTime: 5000,
//   minTransitionTime: 100,
//   totalTransitions: 15
// }
```

## Architecture

The library is built with:

- **XState**: State machine management
- **neverthrow**: Functional error handling
- **Wagmi/Viem**: Ethereum interactions
- **React**: Hook integrations

### Key Services

1. **TransactionService**: Handles transaction submission and monitoring
2. **AuditTrailService**: Records all state transitions and events
3. **Transaction Machine**: XState machine managing transaction lifecycle

## Development

```bash
# Install dependencies
pnpm install

# Build package
pnpm build

# Run tests
pnpm test

# Development mode
pnpm dev
```

## Configuration

### Environment Variables

```bash
# Optional: Custom bundler URL for 4337
VITE_BUNDLER_URL=http://localhost:4337

# Optional: Enable remote audit logging
VITE_ENABLE_REMOTE_AUDIT=true
```

## License

MIT