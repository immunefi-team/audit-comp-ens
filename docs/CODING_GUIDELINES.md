# Apps Monorepo Coding Guidelines

## Philosophy

**Keep the React layer as thin as possible.**

React components should focus on presentation and user interaction, not business logic or state management. Extract logic into reusable functions and manage complex state in XState machines.

**Prefer pure functions over classes.**

Classes introduce additional complexity and coupling. Use pure functions, modules with exported functions, and services where possible. Reserve classes only for cases where object-oriented patterns provide clear benefits (e.g., third-party library requirements).

## React Layer Principles

### ❌ Avoid Custom Hooks (Unless Absolutely Necessary)

Custom hooks often hide complexity and make components harder to understand. They create indirection and can lead to over-abstraction.

**Bad:**
```tsx
// ❌ Custom hook hiding business logic
function useENSRenewal(options) {
  const [state, setState] = useState(...)
  const [cached, setCached] = useState(...)

  const renewName = useCallback(async () => {
    // 50+ lines of business logic
  }, [deps])

  return { renewName, state, cached }
}

// Component usage
function Component() {
  const { renewName } = useENSRenewal({ ... })
  return <button onClick={renewName}>Renew</button>
}
```

**Good:**
```tsx
// ✅ Direct helper usage, explicit data flow
import { prepareENSRenewal } from '@ens-apps/helpers'

function Component() {
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  const handleRenew = async () => {
    const result = await prepareENSRenewal({
      publicClient,
      walletClient,
      name: 'vitalik',
      duration: 31536000n
    })

    if (result.isOk()) {
      // Use result
    }
  }

  return <button onClick={handleRenew}>Renew</button>
}
```

### ✅ When Custom Hooks ARE Acceptable

1. **Wagmi/React Query hooks** - Third-party library hooks are fine
2. **DOM/Browser APIs** - `useWindowSize`, `useMediaQuery`, `useLocalStorage`
3. **Framework integrations** - `useMachine` from `@xstate/react`
4. **Reusable UI patterns** - `useDisclosure`, `useToggle` for simple UI state
5. **Form management** - `useForm`, `useField` for form-specific logic

**Examples of acceptable hooks:**
```tsx
// ✅ Third-party integration
const { address } = useAccount()
const publicClient = usePublicClient()

// ✅ XState integration
const [state, send] = useMachine(transactionMachine)

// ✅ Simple UI state helper
const { isOpen, onOpen, onClose } = useDisclosure()
```

## State Management

### XState for Complex State

Use XState machines for:
- Multi-step workflows (transactions, forms, wizards)
- Complex state transitions with side effects
- Retry logic, timeout handling, error recovery
- State that needs to be persisted or debugged

**Example:**
```tsx
import { useMachine } from '@xstate/react'
import { transactionMachine } from '@ens-apps/transaction-manager'

function Component() {
  const [state, send] = useMachine(transactionMachine, {
    input: { transactionService }
  })

  // Direct state access
  const isLoading = state.matches('preparing')
  const hash = state.context.hash

  // Direct event sending
  const handleExecute = () => {
    send({ type: 'EXECUTE', request })
  }

  return <button onClick={handleExecute} disabled={isLoading}>Send</button>
}
```

### React State for Simple UI State

Use `useState` for:
- Form inputs and UI controls
- Toggle states (modals, dropdowns)
- Temporary/derived UI state
- Simple caching

**Example:**
```tsx
function Component() {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  return (
    <div>
      <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      <button onClick={() => setIsOpen(true)}>Open</button>
    </div>
  )
}
```

## Business Logic Extraction

### Helper Functions Over Hooks

Extract business logic into pure helper functions:

**Structure:**
```
src/
  helpers/
    ens-renewal.helpers.ts    # ENS-specific business logic
    validation.helpers.ts     # Validation utilities
    formatting.helpers.ts     # Data formatting
  machines/
    transaction.machine.ts    # Complex state machines
  components/
    ENSRenewal.tsx           # Thin presentation layer
```

**Example helper:**
```typescript
// helpers/ens-renewal.helpers.ts
import { ok, err, type Result } from 'neverthrow'

export async function prepareENSRenewal(
  params: PrepareENSRenewalParams
): Promise<Result<TransactionData, Error>> {
  try {
    // Pure business logic
    const price = await getPrice(params.name)
    const data = encodeRenewal(params.name, params.duration)

    return ok({ to, data, value: price })
  } catch (error) {
    return err(error)
  }
}
```

**Component using helper:**
```tsx
// components/ENSRenewal.tsx
import { prepareENSRenewal } from '../helpers/ens-renewal.helpers'

function ENSRenewal() {
  const handleRenew = async () => {
    const result = await prepareENSRenewal({ name, duration })

    if (result.isOk()) {
      // Use result.value
    } else {
      // Handle result.error
    }
  }

  return <button onClick={handleRenew}>Renew</button>
}
```

## UI & Icons

### Lucide Icons
- Size lucide icons with Tailwind’s `size-*` class via `className`.
- Don’t pass `width`, `height`, or `size` props to lucide icons.
- Example: `<CalendarIcon className="size-3.5" />` (replaces `<CalendarIcon height={14} width={14} />`).

## Benefits of This Approach

### ✅ Testability
- Pure functions are easy to unit test
- No need to mock React hooks
- XState machines are testable in isolation

### ✅ Reusability
- Helpers can be used in any context (React, Node.js, tests)
- XState machines can be used outside React
- No coupling to React lifecycle

### ✅ Explicitness
- Data flow is visible in component code
- No hidden side effects in custom hooks
- Easy to understand what a component does

### ✅ Maintainability
- Business logic changes don't require React updates
- Components stay focused on UI concerns
- Clear separation of concerns

## Anti-Patterns to Avoid

### ❌ Business Logic in Custom Hooks

```tsx
// ❌ Don't do this
function useComplexBusinessLogic() {
  const [state, setState] = useState()

  useEffect(() => {
    // Complex side effects
    // Data fetching
    // Business rules
  }, [deps])

  const doSomething = useCallback(() => {
    // More business logic
  }, [])

  return { state, doSomething }
}
```

### ❌ Hooks Wrapping Other Hooks

```tsx
// ❌ Don't do this
function useWrappedHook() {
  const data1 = useHook1()
  const data2 = useHook2()

  return { ...data1, ...data2 }
}

// ✅ Do this instead
function Component() {
  const data1 = useHook1()
  const data2 = useHook2()

  // Use data directly
}
```

### ❌ State Management in Hooks

```tsx
// ❌ Don't do this
function useStateManagement() {
  const [value, setValue] = useState()

  return {
    value,
    setValue,
    // Derived state, actions, etc.
  }
}

// ✅ Do this instead - use XState for complex state
const [state, send] = useMachine(machine)
```

## Code Organization

### Prefer Pure Functions Over Classes

**Bad:**
```typescript
// ❌ Class-based service with instance state
export class AuditTrailService {
  private transitions: StateTransition[] = []
  private auditLog: AuditEntry[] = []

  recordTransition(transition: StateTransition): void {
    this.transitions.push(transition)
    this.save()
  }

  private save(): void {
    localStorage.setItem('audit', JSON.stringify({
      transitions: this.transitions,
      auditLog: this.auditLog
    }))
  }
}

// Usage requires instantiation
const service = new AuditTrailService()
service.recordTransition(transition)
```

**Good:**
```typescript
// ✅ Module with pure functions
function loadFromStorage(): AuditTrailData {
  const data = localStorage.getItem('audit')
  return data ? JSON.parse(data) : { transitions: [], auditLog: [] }
}

function saveToStorage(data: AuditTrailData): void {
  localStorage.setItem('audit', JSON.stringify(data))
}

export function recordTransition(transition: StateTransition): void {
  const data = loadFromStorage()
  data.transitions.push(transition)
  saveToStorage(data)
}

// Usage is direct and simple
import * as auditTrail from './audit-trail.service'
auditTrail.recordTransition(transition)
```

**Benefits:**
- ✅ No instantiation required
- ✅ Easier to test (no mocking classes)
- ✅ Simpler imports and usage
- ✅ More functional programming friendly
- ✅ Better tree-shaking in bundlers

**When classes ARE acceptable:**
- Third-party library requirements
- Complex object hierarchies with inheritance
- Encapsulation with private state that truly benefits from OOP

## Component Props

- Use arrow functions for React components: `export const Component = (props) => { ... }`.
- Use a named props interface per component: `<ComponentName>Props`.
- Define it next to the component; export only if reused elsewhere.

Example:

```tsx
interface NameCountProps { address: Address }
export const NameCount = ({ address }: NameCountProps) => { /* ... */ }
```

## Summary

**Golden Rules:**

1. **Keep React components thin** - Focus on rendering and event handling
2. **Extract business logic to helpers** - Pure functions over custom hooks
3. **Use XState for complex state** - Multi-step flows, transactions, workflows
4. **Use React state for UI state** - Form inputs, toggles, simple caching
5. **Be explicit** - Make data flow visible in component code
6. **Minimize custom hooks** - Only when truly necessary (DOM APIs, framework integration)
7. **Prefer pure functions over classes** - Use module exports instead of class instances

**Ask yourself:**
- Can this logic work outside React? → Make it a helper function
- Is this UI state or business state? → React state vs XState
- Am I hiding complexity in a hook? → Extract to helper instead
- Would a new developer understand this component easily? → Keep it explicit
- Am I using a class when functions would suffice? → Use module exports instead

---

*These guidelines apply to the apps-monorepo codebase. Following them ensures consistency, maintainability, and testability across the project.*
