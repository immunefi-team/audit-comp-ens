# ENS Portal App Style Guide

A comprehensive guide for writing clean, maintainable, and type-safe code for the ENS Portal application.

> **Note for Contributors**: This guide is opinionated by design to maintain consistency across the codebase. When in doubt, follow existing patterns and favor clarity. Reasonable exceptions are allowed when justified—see the **Rule Severity** section for guidance on when rules are mandatory vs. preferred.

## Breaking the Rules

**Every rule can and will be broken in certain cases.** When you deviate from these guidelines:

1. ✅ **Leave a comment in the code** explaining why
2. ✅ **Make it intentional** - not accidental
3. ✅ **Document the trade-off** - what you gained vs what you gave up

```typescript
// ✅ GOOD - Rule break is documented
function processLargeDataset(data: any) { // Using 'any' because third-party library has no types
  return transform(data)
}

// ❌ BAD - Silent rule break
function processLargeDataset(data: any) {
  return transform(data)
}
```

**Rule breaks should always be intentional, not accidental.**

## Table of Contents

- [Core Principles](#core-principles)
- [Rule Severity](#rule-severity)
- [Tech Stack Overview](#tech-stack-overview)
- [File Structure \& Organization](#file-structure--organization)
- [Naming Conventions](#naming-conventions)
- [TypeScript Usage](#typescript-usage)
- [React Patterns](#react-patterns)
- [State Management](#state-management)
- [Business Logic Extraction](#business-logic-extraction)
- [Error Handling with neverthrow](#error-handling-with-neverthrow)
- [Data Fetching with TanStack Query](#data-fetching-with-tanstack-query)
- [Web3 \& Blockchain Patterns](#web3--blockchain-patterns)
- [Component Composition](#component-composition)
- [Performance Guidelines](#performance-guidelines)
- [Error Boundaries](#error-boundaries)
- [Styling with Tailwind CSS](#styling-with-tailwind-css)
- [Routing with TanStack Router](#routing-with-tanstack-router)
- [Accessibility](#accessibility)
- [General TypeScript/JavaScript Coding Guidelines](#general-typescriptjavascript-coding-guidelines)
- [Advanced neverthrow Patterns](#advanced-neverthrow-patterns)
- [Testing Strategy](#testing-strategy)
- [Code Formatting \& Linting with Biome](#code-formatting--linting-with-biome)
- [Summary](#summary)
- [References](#references)

## Core Principles

The ENS Portal codebase is built on these fundamental principles:

### 1. Thin React Layer

**Keep React components focused on presentation and user interaction, not business logic.**

Components should:
- Render UI based on props and state
- Handle user events by calling external functions
- Manage simple UI state (modals, form inputs)

Components should NOT:
- Contain complex business logic
- Directly manipulate blockchain state
- Include data transformation logic

### 2. Code Co-location

**Place code next to where it's used, not grouped by technical type.**

✅ **DO**: Place helper files next to the single component that uses them
❌ **DON'T**: Create shared folders for single-use code
✅ **DO**: Only use shared folders when code is used by 2+ files

### 3. Explicit Over Implicit

**Make data flow visible and dependencies clear.**

- Use pattern matching over conditional operators
- Pass dependencies as explicit parameters
- Avoid hiding business rules in control flow

### 4. Functional-Light Programming

**Embrace functional programming principles pragmatically:**

- **Immutability**: Transform data, don't mutate it (🔴 Must)
- **Pure functions**: Same input → same output, no side effects (🟡 Default)
- **Composition**: Build complex operations from simple ones (🟡 Default)
- **Prefer array methods**: Use `map`, `filter`, `reduce` over loops (🟢 Guideline)
  - Loops are allowed when: Early exit is required, performance is critical, or readability is improved

### 5. Type Safety First

**Leverage TypeScript to catch errors at compile time:**

- Strict mode enabled
- Explicit type annotations for function signatures
- No `any` types (use `unknown` if needed)
- Use discriminated unions for state management

## Rule Severity

Not all rules are equally important. Use these tiers to guide your decisions:

### 🔴 Must (Violations require strong justification)

These rules protect against bugs, security issues, or severe maintainability problems:

- **Thin React Layer** - Business logic must be extracted from components
- **Use neverthrow for Result types** - Never mix Result with try-catch
- **Type safety** - No `any` types, use `unknown` + type guards (use `Record<string, unknown>` for objects)
- **BigInt for blockchain values** - All numeric blockchain values use BigInt
- **Immutability** - Don't mutate data structures
- **Never use useEffect for data fetching** - Always use TanStack Query

### 🟡 Default (Follow unless there is a clear reason not to)

These rules represent best practices but allow pragmatic exceptions:

- **TanStack Query for async data** - Don't manually manage loading/error states with useState
- **Extract useEffect** - Effects in components should be in custom hooks (≤5 lines can stay inline)
- **Avoid query waterfalls** - Split dependent queries into separate components
- **Handle query states independently** - Don't group loading/error states with `||`
- **Use useQueries for parallel queries** - More concise than multiple useQuery calls
- **Use generics to preserve types** - Don't lose type information in utility functions
- **Pattern matching over conditionals** - Use ts-pattern for complex conditions
- **Readonly modifiers** - Mark data as readonly when it won't change
- **Custom hooks for logic** - Avoid custom hooks for business logic (use for DOM/framework APIs)
- **Pure functions** - Extract testable logic to pure functions

### 🟢 Guideline (Preferable, not mandatory)

These rules improve code quality but are stylistic preferences:

- **Array methods over loops** - Prefer `map`/`filter`/`reduce` (loops OK for performance/clarity)
- **Component size** - Keep components under 80 lines (flexible based on complexity)
- **Co-location** - Place code next to usage (balance with reusability)
- **Explaining variables** - Extract complex expressions (use judgment)

**When in doubt**: Follow existing patterns and prioritize clarity over dogma. If a rule seems wrong for your case, document why and discuss with the team.

## Tech Stack Overview

The Portal app uses modern web and Web3 technologies:

### Core Framework
- **React 19** - UI framework with modern hooks and concurrent features
- **TypeScript 5.9** - Type-safe JavaScript with strict mode
- **Vite 7** - Fast build tool with HMR

### State & Data Management
- **TanStack Query 5** - Server state management and caching
- **TanStack Router 1** - Type-safe routing with code splitting
- **XState 5** - State machines for complex workflows
- **neverthrow 8** - Functional error handling with Result types

### Web3 Stack
- **wagmi 3** - React hooks for Ethereum
- **viem 2** - TypeScript Ethereum library
- **@ensdomains/ensjs** - ENS protocol interactions
- **Custom wallet modal** - Wallet connection UI (EIP-6963 discovery + WalletConnect)

### UI & Styling
- **Tailwind CSS 4** - Utility-first CSS framework
- **Shadcn UI** - Beautifully designed components built on Radix UI (in `components/ui/`)
- **Radix UI** - Unstyled, accessible component primitives
- **class-variance-authority** - Type-safe variant styling
- **Lucide React** - Icon library (Temporary until icons are provided by UX team)

### Testing & Quality
- **Vitest** - Unit testing framework
- **Biome** - Fast formatter and linter
- **Testing Library** - Component testing utilities

## File Structure & Organization

### Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Shadcn UI components (built on Radix) - Base primitives
│   ├── molecules/      # Composed components (2-3 ui/* components combined)
│   └── organisms/      # Complex shared components (business logic + multiple molecules)
├── features/           # Feature-based modules
│   └── profile/
│       ├── components/ # Feature-specific components (not reused elsewhere)
│       ├── hooks/      # Feature-specific hooks
│       └── utils/      # Feature-specific utilities (2+ files)
├── hooks/              # Shared custom hooks (2+ files)
├── lib/                # Shared library code
│   ├── constants/      # App constants
│   ├── utils/          # Shared utilities
│   └── wagmi/          # Wagmi configuration
├── routes/             # TanStack Router route files
├── styles/             # Global styles
└── utils/              # Shared utility functions (2+ files)
```

**Component hierarchy**:
- **`ui/`** → Single-purpose primitives (Button, Input, Dialog)
- **`molecules/`** → Composition of 2-3 UI components, minimal logic (SearchBar = Input + Button, FormField = Label + Input + ErrorText)
- **`organisms/`** → Complex shared components with business logic, used across features (ConnectWalletModal, TransactionStatusCard)
- **`features/*/components/`** → Feature-specific components, any complexity, not reused outside the feature

### File Naming Conventions

- **React Components**: `PascalCase.tsx` (e.g., `UserProfile.tsx`)
- **Utility Files**: `camelCase.ts` (e.g., `formatEther.ts`)
- **Hooks**: `use*.ts` (e.g., `useProfile.ts`)
- **Types**: `*.types.ts` (e.g., `profile.types.ts`)
- **Handlers**: `*.handlers.ts` (e.g., `ProfileEdit.handlers.ts`)
- **State Machines**: `*.machine.ts` (e.g., `registration.machine.ts`)
- **Mock Data**: `*.mock.ts` or `MOCK.ts` (e.g., `profile.mock.ts`)
- **Test Files**: `*.test.ts(x)` (e.g., `UserProfile.test.tsx`)
- **Route Files**: TanStack Router conventions (e.g., `$name.tsx`)

**Co-location with handlers:**

```
features/profile/components/
├── ProfileEdit.tsx
├── ProfileEdit.handlers.ts    # Event handlers for ProfileEdit
└── ProfileEdit.test.tsx
```

**Benefits of `*.handlers.ts`:**
- ✅ Clear separation of UI from logic
- ✅ Easy to test handlers independently
- ✅ Co-located with the component that uses them

### Mock Data Policy 🟡 Default

**All mock data must live in `*.mock.ts` or `MOCK.ts` files and be gated by dev flags.**

```typescript
// ❌ AVOID - Mock data in production code
export const ProfileCard = ({ userId }: Props) => {
  const mockUser = { id: 1, name: 'Test User' } // Don't do this
  const user = userId ? fetchUser(userId) : mockUser
  return <div>{user.name}</div>
}

// ✅ CORRECT - Mock data in separate file, dev-only
// profile.mock.ts
export const mockUser = {
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
}

export const mockUsers = [mockUser, /* ... */]

// ProfileCard.tsx
import { mockUser } from './profile.mock'

export const ProfileCard = ({ userId }: Props) => {
  const user = import.meta.env.DEV 
    ? mockUser 
    : fetchUser(userId)
  
  return <div>{user.name}</div>
}
```

**Benefits:**
- ✅ **No mock data in production** - Gated by dev flags
- ✅ **Easy to find** - All mocks in `*.mock.ts` files
- ✅ **Reusable** - Share mocks across tests and dev mode
- ✅ **Type-safe** - Mocks match real data structures

**Dev flag options:**
- `import.meta.env.DEV` - Vite dev mode
- `process.env.NODE_ENV === 'development'` - Node/general
- Feature flags - For gradual rollout

### Co-location Examples

```typescript
// ❌ AVOID: Single-use helper in shared folder
src/
├── utils/
│   └── formatProfileName.ts  // Only used by ProfileCard.tsx
└── features/
    └── profile/
        └── components/
            └── ProfileCard.tsx

// ✅ CORRECT: Co-located next to usage
src/
└── features/
    └── profile/
        └── components/
            ├── ProfileCard.tsx
            └── ProfileCard.helpers.ts  // formatProfileName lives here
```

## Naming Conventions

### Variables and Functions

Use descriptive, intention-revealing names:

```typescript
// Good
const getUserProfile = (name: string): Promise<Profile> => { ... }
const isNameAvailable = (name: string): boolean => { ... }
const MAX_REGISTRATION_DURATION = 31536000n

// Avoid
const gUP = (n: string): Promise<Profile> => { ... }
const check = (n: string): boolean => { ... }
const x = 31536000n
```

### Boolean Naming

Prefix with `is`, `has`, `should`, or `can`:

```typescript
// Good
const isLoading = status === 'pending'
const hasResolver = !!resolverAddress
const canEditRecords = checkPermission(user, 'edit')
const shouldShowBanner = isExpiringSoon && !dismissed

// Avoid
const loading = status === 'pending'
const resolver = !!resolverAddress
const editRecords = checkPermission(user, 'edit')
```

### Type and Interface Naming

```typescript
// Use PascalCase for types and interfaces
interface UserProfile {
  name: string
  address: Address
}

type ProfileStatus = 'loading' | 'success' | 'error'

// Use descriptive names for generics
function getProperty<TObject, TKey extends keyof TObject>(
  obj: TObject,
  key: TKey
): TObject[TKey] {
  return obj[key]
}

// Props interfaces: <ComponentName>Props
interface ProfileCardProps {
  name: string
  address: Address
}
```

### Constants

Use `UPPER_SNAKE_CASE` for true constants:

```typescript
// Constants that represent fixed values
const MAX_NAME_LENGTH = 253
const SECONDS_PER_YEAR = 31536000n
const ENS_REGISTRY_ADDRESS = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e' as const

// Configuration objects use camelCase
const wagmiConfig = {
  chains: [mainnet, sepolia],
  transports: { ... }
}
```

## TypeScript Usage

### Strict Type Annotations

Always define types for function parameters and return values:

```typescript
// Good
interface GetProfileParams {
  readonly name: string
  readonly includeRecords?: boolean
}

function getProfile(params: GetProfileParams): ResultAsync<Profile, ProfileError> {
  // ...
}

// Avoid
function getProfile(params) {
  // ...
}
```

### Use Readonly for Immutability

```typescript
// Good
interface UserProfile {
  readonly name: string
  readonly addresses: readonly Address[]
}

const processAddresses = (addresses: readonly Address[]): readonly Address[] => {
  return addresses.filter(isValid)
}

// Avoid
interface UserProfile {
  name: string
  addresses: Address[]
}

const processAddresses = (addresses: Address[]): Address[] => {
  return addresses.filter(isValid)
}
```

### Type Narrowing

Use type guards and discriminated unions:

```typescript
// Good - Discriminated union
type TransactionState =
  | { status: 'idle' }
  | { status: 'pending'; hash: Hex }
  | { status: 'success'; hash: Hex; receipt: TransactionReceipt }
  | { status: 'error'; error: Error }

function handleTransaction(state: TransactionState) {
  if (state.status === 'success') {
    // TypeScript knows state.receipt exists
    console.log(state.receipt)
  }
}

// Type guard
function isAddress(value: unknown): value is Address {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value)
}
```

### Avoid `any`, Use `unknown` 🔴 Must

```typescript
// ❌ AVOID - any bypasses type checks
function parseData(data: any) {
  return data.value
}

// ✅ CORRECT - unknown with type guard
function parseData(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return String(data.value)
  }
  throw new Error('Invalid data')
}

// ✅ CORRECT - Record for unknown object shapes
function processConfig(config: Record<string, unknown>) {
  // Type-safe access to object properties
  const name = typeof config.name === 'string' ? config.name : 'default'
  return name
}

// ✅ ACCEPTABLE - Record<string, any> when structure is truly unknown
// Use sparingly, prefer Record<string, unknown> for stricter type safety
function processApiResponse(response: Record<string, any>) {
  // When you need flexibility but know it's an object
  return response
}
```

**Guidelines:**
- ✅ **Use `unknown`** - For values of unknown type (requires type guards)
- ✅ **Use `Record<string, unknown>`** - For objects with unknown shape (stricter)
- ⚠️ **Use `Record<string, any>`** - Only when you need flexibility and know it's an object
- ❌ **Never use `any`** - Bypasses all type safety

### Use Generics to Preserve Types 🟡 Default

When working with strongly typed objects, use generics to preserve type information:

```typescript
// ✅ CORRECT - Generic preserves type
function getObjectValue<T extends object, K extends keyof T>(
  obj: T,
  key: K
): T[K] {
  return obj[key]
}

// Usage - return type is automatically inferred
interface User {
  name: string
  age: number
}

const user: User = { name: 'Alice', age: 30 }
const userName = getObjectValue(user, 'name') // Type: string
const userAge = getObjectValue(user, 'age')   // Type: number

// ✅ CORRECT - Generic with constraints
function mapObject<T extends object, R>(
  obj: T,
  mapper: (value: T[keyof T], key: keyof T) => R
): R[] {
  return Object.entries(obj).map(([key, value]) => 
    mapper(value as T[keyof T], key as keyof T)
  )
}

// ❌ AVOID - Loses type information
function getObjectValue(obj: object, key: string): unknown {
  return (obj as any)[key] // No type safety
}
```

**Benefits:**
- ✅ **Type preservation** - Return types inferred from input types
- ✅ **IntelliSense support** - Better autocomplete
- ✅ **Compile-time safety** - Catch errors before runtime

## React Patterns

### Component Definition

**Use arrow functions for React components:**

```typescript
// Good - Arrow function export (standard pattern)
export const ProfileCard = ({ name, address }: ProfileCardProps) => {
  return (
    <div>
      <h2>{name}</h2>
      <p>{address}</p>
    </div>
  )
}

// Good - Inline arrow function for router components
export const Route = createRootRoute({
  component: () => <Outlet />,
})

// Avoid - Function declaration for components (use for utilities only)
export function ProfileCard({ name, address }: ProfileCardProps) {
  return <div>...</div>
}

// Avoid - Function expression
export const ProfileCard = function({ name, address }: ProfileCardProps) {
  return <div>...</div>
}
```

**Note**: Function declarations (`function`) are reserved for utility functions and helpers, not React components.

**Exception — Route component functions**: In TanStack Router route files (`routes/`), the `RouteComponent` function referenced by `createFileRoute` may use a function declaration. This is the convention used by TanStack Router's code generation and keeps route files consistent with the router's own patterns.

```typescript
// Good - Function declaration for route components in route files
export const Route = createFileRoute('/$name/deploy-registry')({
  component: RouteComponent,
})

function RouteComponent() {
  const { name } = Route.useParams()
  // ...
}
```

### Component Props

Define props interfaces next to the component:

```typescript
// Good - Named interface with arrow function
interface ProfileCardProps {
  readonly name: string
  readonly address: Address
  readonly onEdit?: () => void
}

export const ProfileCard = ({ name, address, onEdit }: ProfileCardProps) => {
  return <div>...</div>
}

// Good - Inline type for simple components
export const Button = ({
  children,
  variant = 'default',
  ...props
}: React.ComponentProps<'button'> & { variant?: 'default' | 'outline' }) => {
  return <button {...props}>{children}</button>
}

// Good - Destructuring with type annotation
export const NameProfileCard = ({ name }: { name: string }) => {
  return <div>{name}</div>
}
```

### Pattern Matching for Conditional Rendering (🟡 Default)

Use `ts-pattern` for complex conditional logic over ternaries or `&&` operators:

> **Performance Note**: `ts-pattern` has some overhead due to JIT compilation ([benchmark details](https://github.com/bdbaraban/ts-pattern-benchmark/pull/1)). For simple conditions or hot paths, native conditionals may be faster. Measure if performance is critical (see [Performance Guidelines](#performance-guidelines)).

```typescript
import { match } from 'ts-pattern'
import { P } from 'ts-pattern'

// Good - Explicit pattern matching
export const ProfileStatus = ({ status }: { status: ProfileStatus }) => {
  return match(status)
    .with({ type: 'loading' }, () => <LoadingSpinner />)
    .with({ type: 'error', error: P.select() }, (error) => (
      <ErrorMessage error={error} />
    ))
    .with({ type: 'success', data: P.select() }, (data) => (
      <ProfileCard profile={data} />
    ))
    .exhaustive()
}

// Avoid - Nested ternaries
export const ProfileStatus = ({ status }) => {
  return status.type === 'loading' 
    ? <LoadingSpinner />
    : status.type === 'error'
    ? <ErrorMessage error={status.error} />
    : <ProfileCard profile={status.data} />
}

// Avoid - && operators with potential falsy bugs
export const ShowPrice = ({ price }) => {
  return price && <div>Price: {price}</div>  // Breaks if price is 0
}

// Good - Explicit nullish check
export const ShowPrice = ({ price }: { price: bigint | null }) => {
  return match({ price })
    .with({ price: P.not(P.nullish) }, ({ price }) => (
      <div>Price: {formatEther(price!)}</div>
    ))
    .otherwise(() => null)
}
```

### Extract Static Values and Pure Functions

Keep component bodies clean by extracting static values:

```typescript
// Avoid - Recreated on every render
export const RegistrationForm = () => {
  const YEAR_IN_SECONDS = 31536000n
  const config = {
    minDuration: YEAR_IN_SECONDS,
    maxDuration: YEAR_IN_SECONDS * 10n,
  }
  
  const calculatePrice = (duration: bigint) => {
    // calculation logic
  }
  
  return <form>...</form>
}

// Good - Extracted outside component
const YEAR_IN_SECONDS = 31536000n

const REGISTRATION_CONFIG = {
  minDuration: YEAR_IN_SECONDS,
  maxDuration: YEAR_IN_SECONDS * 10n,
} as const

function calculateRegistrationPrice(
  baseFee: bigint,
  duration: bigint
): bigint {
  return baseFee * duration / YEAR_IN_SECONDS
}

export const RegistrationForm = () => {
  return <form>...</form>
}
```

### Never Use useEffect for Data Fetching 🔴 Must

**Always use TanStack Query for data fetching** - never fetch data in `useEffect`.

```typescript
// ❌ NEVER DO THIS - Data fetching in useEffect
export const ProfilePage = ({ name }: { name: string }) => {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  
  useEffect(() => {
    let cancelled = false
    
    async function fetchProfile() {
      setLoading(true)
      try {
        const result = await getProfile(name)
        if (!cancelled && result.isOk()) {
          setProfile(result.value)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(e as Error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    
    fetchProfile()
    return () => { cancelled = true }
  }, [name])
  
  if (loading) return <LoadingSpinner />
  if (error) return <ErrorMessage error={error} />
  return <ProfileView profile={profile} />
}

// ✅ ALWAYS DO THIS - Use TanStack Query
export const ProfilePage = ({ name }: { name: string }) => {
  const { data: profile, isLoading, error } = useQuery(getProfileQueryOptions(name))
  
  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage error={error} />
  if (!profile) return null
  return <ProfileView profile={profile} />
}
```

**Why useEffect is problematic for data fetching:**
- ❌ **Waterfalls** - Dependencies cause sequential fetches
- ❌ **Race conditions** - React 18+ concurrent mode can race effects
- ❌ **No caching** - Same data fetched multiple times
- ❌ **Messy error handling** - Manual state management
- ❌ **No retry logic** - Must implement yourself
- ❌ **No stale data** - Can't show stale while revalidating

**TanStack Query solves all of these** - use it for ALL data fetching.

### useEffect Usage Policy (🟡 Default)

**Default rule**: In components, extract `useEffect` into a named custom hook to document intent and keep components readable.

**Valid use cases for useEffect:**
- DOM manipulation (focus, scroll, resize observers)
- Setting up/tearing down subscriptions
- Syncing with external systems (localStorage, WebSocket)
- Side effects triggered by prop/state changes

```typescript
// ❌ AVOID: Naked useEffect in component
export const ModalComponent = ({ isOpen }: { isOpen: boolean }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])
  
  return <div>...</div>
}

// ✅ CORRECT: Extract into named hook
function useLockBodyScroll(isLocked: boolean) {
  useEffect(() => {
    if (isLocked) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isLocked])
}

export const ModalComponent = ({ isOpen }: { isOpen: boolean }) => {
  useLockBodyScroll(isOpen)
  return <div>...</div>
}

export const ProfilePage = ({ name }: { name: string }) => {
  const [profile, setProfile] = useState<Profile | null>(null)
  
  useProfileData(name, setProfile)
  
  return <div>...</div>
}
```

**Why extract effects?**
- Hook name documents the purpose
- Component body stays focused on rendering
- Effects are testable independently
- Easier to reuse across components

**Allowed exceptions** (must stay trivial):
- ≤ 5 lines of code
- No async logic
- No domain or multi-branch logic  
  (trivial guards like `if (!ref.current) return` are fine)
- No external dependencies

```typescript
// ✅ Acceptable: Simple DOM sync effect
export const AutoFocusInput = () => {
  const ref = useRef<HTMLInputElement>(null)
  
  useEffect(() => {
    ref.current?.focus()
  }, [])
  
  return <input ref={ref} />
}
```

**If an effect grows beyond these constraints, extract it immediately.**

**Note**: This rule applies to components only. Inside custom hooks, `useEffect` is expected and does not need further extraction—that's where effects belong.

### Component Size and Complexity (🟢 Guideline)

**Split by responsibility, not line counts.** There's no objective maximum — line and prop counts are just "look here" prompts to ask "is this doing too much?" The real gate is **cognitive complexity** (how hard the control flow is to follow), enforced by Biome's `noExcessiveCognitiveComplexity` (threshold 15).

| Dimension | Tripwire | How it's checked |
| --- | --- | --- |
| Cognitive complexity | 15 per function | Biome (`warn`) — hard signal |
| File length | ~500 lines | Greptile soft signal |
| Component/function length | ~150 lines | Manual — covered by the complexity gate above |
| One primary component per file | 1 primary (small helpers OK, even with minor state) | Greptile soft signal |

> Exempt: generated files, tests, mocks, and Storybook stories (which intentionally pass many props and export several components).

**When to split:**
- ✅ Component has multiple concerns (data fetching + rendering + form logic)
- ✅ Logic is reusable across multiple parents
- ✅ Component is hard to understand due to complexity (not size)
- ✅ Different parts change for different reasons

**When NOT to split:**
- ❌ Component is mostly static JSX (navigation would take longer than reading)
- ❌ Split components are 50% type definitions and props drilling
- ❌ You're only splitting to hit a line count target

```typescript
// ❌ Over-split - Harder to follow, mostly definitions
const ProfileHeader = ({ name, avatar }: ProfileHeaderProps) => {
  return (
    <header className="flex items-center gap-4">
      <Avatar src={avatar} />
      <h1>{name}</h1>
    </header>
  )
}

// ✅ Good - Split when there's actual complexity
const ProfileRecordsEditor = ({ records, onChange }: Props) => {
  const [editMode, setEditMode] = useState(false)
  const { writeContractAsync } = useWriteContract()
  
  const handleSave = async () => {
    // 30+ lines of validation, encoding, transaction logic
  }
  
  return editMode ? <Editor /> : <Display />
}

const ProfilePage = ({ name }: ProfilePageProps) => {
  const { data: profile } = useQuery(getProfileQueryOptions(name))
  
  return (
    <div>
      {/* ✅ Static header stays inline - easy to read */}
      <header className="flex items-center gap-4">
        <Avatar src={profile.avatar} />
        <h1>{profile.name}</h1>
      </header>
      
      {/* ✅ Complex editor extracted - manages its own state and logic */}
      <ProfileRecordsEditor 
        records={profile.records}
        onChange={handleUpdate}
      />
    </div>
  )
}
```

**Rule of thumb**: If finding the split component takes longer than scanning the original, don't split it.

### Number of Props (🟢 Guideline)

**A long prop list is a "long parameter list" smell — but there's no hard cap.** Treat **~10 props as a prompt to review**, not a violation (a component can have more and still do one thing). The fix is never "delete a prop" — reach for, roughly in order:

1. **Group related props into an object** — a `value` / `onChange` / `label` cluster becomes one prop. Usually collapses the count on its own.
2. **Composition / `children`** instead of configuration props.
3. **Split by responsibility** if the list grew because the component does several things.
4. **Context** — last resort, for genuine prop-drilling pain.

```typescript
// ❌ Tripwire hit — 6 of these props are really two coupled clusters
interface PriceCooldownBannerProps {
  targetPriceInput: string
  onTargetPriceInputChange: (v: string) => void
  onTargetPriceInputBlur: () => void
  selectedPoint: Point
  onSelectedPointChange: (p: Point) => void
  targetPriceReachLabel: string
  // ...13 more
}

// ✅ Group coupled props into objects — fewer, clearer props
interface PriceCooldownBannerProps {
  targetPrice: { value: string; onChange: (v: string) => void; onBlur: () => void; reachLabel: string }
  selection: { point: Point; onChange: (p: Point) => void }
  // ...
}
```

## State Management

### The State Complexity Ladder 🟢 Guideline

As state management needs grow, follow this progression:

```typescript
// 1️⃣ Simple: One or two useState
export const Modal = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  return <Dialog open={isOpen} onOpenChange={setIsOpen}>...</Dialog>
}

// 2️⃣ More complex: useReducer
type State = { count: number; status: 'idle' | 'loading' | 'error'; data: Data | null }
type Action = 
  | { type: 'increment' }
  | { type: 'fetch_start' }
  | { type: 'fetch_success'; data: Data }
  | { type: 'fetch_error' }

export const Counter = () => {
  const [state, dispatch] = useReducer(reducer, initialState)
  return <button onClick={() => dispatch({ type: 'increment' })}>{state.count}</button>
}

// 3️⃣ Even more complex: XState store (context/global state)
import { createStore } from '@xstate/store'

const userStore = createStore({
  context: { user: null, isAuthenticated: false },
  on: {
    login: (context, event) => ({ user: event.user, isAuthenticated: true }),
    logout: () => ({ user: null, isAuthenticated: false }),
  }
})

// 4️⃣ Most complex: XState state machines (workflows with transitions)
const registrationMachine = createMachine({
  initial: 'idle',
  states: {
    idle: { on: { START: 'validating' } },
    validating: { on: { VALID: 'submitting', INVALID: 'error' } },
    submitting: { on: { SUCCESS: 'success', FAILURE: 'error' } },
    success: { type: 'final' },
    error: { on: { RETRY: 'validating' } },
  }
})
```

**When to move up the ladder:**
- **useState → useReducer**: When you have 3+ related state values or complex update logic
- **useReducer → XState Store**: When you need global state or subscriptions
- **XState Store → State Machine**: When you have complex workflows with state transitions, guards, or side effects

**When to stay put:**
- Don't over-engineer - simple state should stay simple
- Most components only need useState
- State machines are for complex multi-step flows (transactions, wizards, onboarding)

### Use React State for Simple UI State

```typescript
// Good - Simple UI state
export const SearchBar = () => {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  
  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setIsOpen(true)}
      />
      {isOpen && <SearchResults query={query} />}
    </div>
  )
}
```

### Use XState for Complex Workflows

Use XState machines for:
- Multi-step transactions
- Complex state transitions
- Retry logic and error recovery
- State that needs audit trails

```typescript
import { useMachine } from '@xstate/react'
import { registrationMachine } from '@/machines/registration.machine'

export const RegistrationFlow = ({ name }: { name: string }) => {
  const [state, send] = useMachine(registrationMachine, {
    input: { name },
  })
  
  // Direct state matching
  const isRegistering = state.matches('registering')
  const registrationHash = state.context.transactionHash
  
  // Direct event sending
  const handleRegister = () => {
    send({ type: 'REGISTER', duration: YEAR_IN_SECONDS })
  }
  
  return match(state.value)
    .with('idle', () => (
      <button onClick={handleRegister}>Register</button>
    ))
    .with('registering', () => (
      <LoadingState hash={registrationHash} />
    ))
    .with('success', () => (
      <SuccessMessage />
    ))
    .exhaustive()
}
```

### Multi-Step Transaction Orchestration Anti-Pattern 🔴 Must

**Never use `useEffect` to chain transactions.** When one transaction must trigger another (e.g., deploy → setSubregistry), use an XState operation machine, not React effects.

#### How to Detect This Anti-Pattern

Look for these signals:
- `useEffect` watching a transaction state (e.g., `state.status === 'success'`)
- Calling `transactionManager.startTransaction()` inside that effect
- Multiple `useState` for separate transaction IDs
- `hasTriggered` flags to prevent duplicate triggers

```typescript
// ❌ ANTI-PATTERN: Effect-based transaction chaining
function useAutoTriggerSecondTransaction({ firstTxState, walletClient }) {
  const [secondTxId, setSecondTxId] = useState<string | null>(null)
  const [hasTriggered, setHasTriggered] = useState(false)

  useEffect(() => {
    if (firstTxState.status !== 'success' || hasTriggered) return

    setHasTriggered(true)

    prepareSecondTransaction().then((result) => {
      const txId = transactionManager.startTransaction(result.value, signer, options)
      setSecondTxId(txId)
    })
  }, [firstTxState, hasTriggered])

  return { secondTxId }
}
```

**Problems with this approach:**
- Two-layer state tracking (hook state + transaction manager state)
- Manual watching via React effect
- `hasTriggered` flag is a code smell for effect misuse
- No built-in persistence for the multi-step flow
- Transactions tracked separately, not as a single operation

```typescript
// ✅ CORRECT: Use an XState machine for multi-step flows
const multiStepMachine = setup({
  // ... machine definition
}).createMachine({
  states: {
    idle: { on: { START: 'firstStep' } },
    firstStep: {
      invoke: { src: 'submitFirstTransaction', onDone: 'waitingForFirst' }
    },
    waitingForFirst: {
      invoke: { src: 'pollTransactionStatus', onDone: 'secondStep' }
    },
    secondStep: {
      invoke: { src: 'submitSecondTransaction', onDone: 'waitingForSecond' }
    },
    waitingForSecond: {
      invoke: { src: 'pollTransactionStatus', onDone: 'success' }
    },
    success: { type: 'final' },
    error: { on: { RETRY: 'firstStep' } }
  }
})

// In component - direct function call, not a hook
const handleStart = () => {
  const txId = transactionManager.startTransaction(request, signer, options)
  setTxId(txId)
}

// Subscribe to transaction state
const actor = transactionManager.getTransaction(txId)
const snapshot = useSelector(actor, s => s)
```

**Benefits of XState machine for multi-step flows:**
- ✅ Single transaction ID tracks the flow
- ✅ Machine orchestrates transitions automatically
- ✅ Built-in retry and error handling
- ✅ Audit trail for all state transitions
- ✅ Direct function call on user action (no effect triggering)

### Single Transaction Pattern 🟡 Default

For **single transactions** (not multi-step flows), use pure async functions with `useMutation` instead of feature-specific XState machines.

#### When to Use This Pattern

- ✅ Single contract call that waits for confirmation
- ✅ Transaction with validation/preparation logic
- ✅ Feature-specific transaction (e.g., save records, set primary name)

#### When NOT to Use This Pattern

- ❌ Multi-step transaction flows (use XState operation machine)
- ❌ Transactions that trigger other transactions
- ❌ Complex retry/recovery logic

#### Pattern Structure

Create a pure async function that orchestrates the transaction:

```typescript
// features/profile/components/ProfileEdit.transactions.ts

export async function saveRecords(
  params: SaveRecordsParams,
): Promise<SaveRecordsResult> {
  // 1. Build and validate the transaction request
  const { request, description } = buildRecordsUpdateRequest(params)

  // 2. Start via transaction manager (handles signing)
  const txId = transactionManager.startTransaction(
    { type: 'custom', request },
    params.signer,
    { description, publicClient: params.publicClient, chainId: params.chainId },
  )

  // 3. Wait for completion (subscribes to transaction actor)
  const result = await waitForTransaction(txId)

  return { ...result, txId }
}
```

#### React Integration with useMutation

Use TanStack Query's `useMutation` to integrate with React:

```typescript
// ✅ CORRECT: useMutation with pure async function
const saveRecordsMutation = useMutation({
  mutationFn: saveRecords,
  onSuccess: () => refetchRecords(),
})

// Use mutation properties directly - no intermediate state needed
<SaveButton
  isSaving={saveRecordsMutation.isPending}
  isSuccess={saveRecordsMutation.isSuccess}
  errorMessage={saveRecordsMutation.error?.message}
  txHash={saveRecordsMutation.data?.hash}
/>
```

```typescript
// ❌ AVOID: Unnecessary derived state
const isSubmitting = saveRecordsMutation.isPending  // Just use .isPending directly
const isSuccess = saveRecordsMutation.isSuccess     // Just use .isSuccess directly
const txHash = saveRecordsMutation.data?.hash       // Just use .data?.hash directly
```

#### File Co-location

Place transaction helpers next to the component that uses them:

```
features/profile/components/
├── ProfileEdit.tsx              # Component
├── ProfileEdit.transactions.ts  # Transaction helpers (co-located)
└── ProfileEdit.handlers.ts      # UI event handlers
```



#### Why Not Just Use Wagmi?

Wagmi's `useWriteContract` and `useSendTransaction` work well for EOA-only transactions, but the ENS app supports multiple account types:

| Feature | Wagmi | Transaction Manager |
|---------|-------|---------------------|
| EOA transactions | ✅ Native | ✅ Via Signer abstraction |
| Smart accounts | ❌ Not supported natively | ✅ Built-in Rhinestone (HCA + Warp) support |
| Unified API across account types | ❌ Different hooks per account type | ✅ Same `startTransaction()` call |
| Transaction persistence | ❌ Not built-in | ✅ IndexedDB/localStorage |
| Receipt polling | ✅ `useWaitForTransactionReceipt` | ✅ `waitForTransaction()` |

### Use TanStack Query for Server State 🟡 Default

**Always use TanStack Query for async data fetching**—don't reinvent the wheel with manual `useState`, loading, and error state management.

```typescript
// ❌ AVOID: Manual state management for async data
export const ProfilePage = ({ name }: { name: string }) => {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  
  useEffect(() => {
    setLoading(true)
    fetchProfile(name)
      .then(setProfile)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [name])
  
  if (loading) return <LoadingState />
  if (error) return <ErrorState error={error} />
  return <ProfileView profile={profile} />
}

// ✅ CORRECT: Use TanStack Query
export const ProfilePage = ({ name }: { name: string }) => {
  const { data: profile, isLoading, error } = useQuery(getProfileQueryOptions(name))
  
  if (isLoading) return <LoadingState />
  if (error) return <ErrorState error={error} />
  return <ProfileView profile={profile} />
}
```

**Benefits of TanStack Query:**
- ✅ **Automatic caching** - No duplicate requests
- ✅ **Background refetching** - Keep data fresh
- ✅ **Error handling** - Built-in retry logic
- ✅ **Loading states** - `isLoading`, `isFetching`, `isError`
- ✅ **Optimistic updates** - Better UX for mutations
- ✅ **Devtools** - Debug queries and cache

See the **Data Fetching with TanStack Query** section for complete patterns and integration with `neverthrow`.

## Business Logic Extraction

### Pure Functions Over Custom Hooks

Extract business logic into pure helper functions, not custom hooks:

```typescript
// ❌ AVOID: Business logic in custom hook
function useENSRenewal(name: string) {
  const [state, setState] = useState<RenewalState>('idle')
  
  const renew = useCallback(async (duration: bigint) => {
    setState('preparing')
    // 50+ lines of business logic
  }, [name])
  
  return { renew, state }
}

// ✅ CORRECT: Pure helper function
// helpers/ens-renewal.helpers.ts
export function prepareENSRenewal(
  params: PrepareRenewalParams
): ResultAsync<RenewalData, RenewalError> {
  return ResultAsync.fromPromise(
    async () => {
      const price = await calculateRenewalPrice(params.name, params.duration)
      const data = encodeRenewFunction(params.name, params.duration)
      return { price, data, to: ENS_REGISTRAR_ADDRESS }
    },
    (error) => new RenewalError({ cause: error })
  )
}

// Component uses helper directly
export const RenewalButton = ({ name }: { name: string }) => {
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { writeContractAsync } = useWriteContract()
  const [isPending, setIsPending] = useState(false)
  
  const handleRenew = async () => {
    if (!walletClient) return
    
    setIsPending(true)
    try {
      const result = await prepareENSRenewal({
        name,
        duration: YEAR_IN_SECONDS,
        publicClient,
        walletClient,
      })
      
      // If helper returns Result, check for errors
      if (result.isErr()) {
        console.error('Failed to prepare renewal:', result.error.message)
        return
      }
      
      // Use the prepared data
      const hash = await writeContractAsync(result.value)
      console.log('Transaction sent:', hash)
    } catch (error) {
      console.error('Failed to renew:', error)
    } finally {
      setIsPending(false)
    }
  }
  
  return (
    <button onClick={handleRenew} disabled={isPending}>
      {isPending ? 'Renewing...' : 'Renew'}
    </button>
  )
}
```

### When to Use a Custom Hook (🟡 Default)

**The core problem with custom hooks for business logic**: Hooks are triggered by React's render cycle, but business logic should be triggered by user actions (clicks, form submits, page loads).

**This is a fundamental mismatch:**
- ❌ **React renders** → Run hook → Execute business logic (wrong trigger)
- ✅ **User action** → Call pure function → Execute business logic (correct trigger)

Custom hooks make you carefully manage _when they run_ (dependencies, conditionals) because they're running at the wrong time. Pure functions called from event handlers run exactly when you want them to.

**Use a custom hook when:**

- ✅ **Wrapping framework or browser APIs** - DOM access, localStorage, Web3 hooks
- ✅ **Integrating third-party hooks** - wagmi, TanStack Query, XState
- ✅ **Managing reusable UI state** - Modal disclosure, toggle patterns, form state
- ✅ **Extracting `useEffect` logic** - See useEffect Usage Policy above

**Do NOT use a custom hook when:**

- ❌ **It primarily performs business logic** - Use pure functions instead
- ❌ **Business logic is triggered by user actions** - Call pure function from event handler
- ❌ **It hides domain rules** - Business rules should be explicit
- ❌ **It mixes IO, state, and transformations** - Separate concerns

```typescript
// ✅ Good: Framework/Browser API wrapper
const { address } = useAccount()
const publicClient = usePublicClient()
const [value, setValue] = useLocalStorageState('theme', { defaultValue: 'dark' })

// ✅ Good: XState integration
const [state, send] = useMachine(transactionMachine)

// ❌ Bad: Business logic in hook
function useENSRenewal(name: string) {
  // 50+ lines of validation, pricing, encoding...
  // This should be pure functions!
}

// ✅ Good: Pure functions + thin hook
function calculateRenewalPrice(name: string, duration: bigint): Result<bigint, Error> {
  // Pure business logic
}

function useENSRenewalMutation() {
  // Just wraps wagmi's useMutation
  return useMutation({ mutationFn: calculateRenewalPrice })
}
```

### Helper Function Structure

```typescript
// Good helper structure
import { ResultAsync, errAsync, okAsync } from 'neverthrow'
import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'

export class RenewalPriceError extends TaggedError('RenewalPriceError')<{
  cause: unknown
}> {}

export const calculateRenewalPrice = ResultFn(async function* (
  name: string,
  duration: bigint
) {
  const client = yield* safeGetClient()
  
  const price = yield* ResultAsync.fromPromise(
    getRenewalPrice(client, { name, duration }),
    (error) => new RenewalPriceError({ cause: error })
  )
  
  return okAsync(price)
})
```

## Error Handling with neverthrow

The codebase uses `neverthrow` for functional error handling with `Result` types.

### Core Principles

1. Use `Result<T, E>` for sync operations, `ResultAsync<T, E>` for async
2. Create specific error classes extending `TaggedError`
3. Always handle both success and error cases explicitly
4. **NEVER mix Result with try-catch**

### Creating Result Functions

```typescript
import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { ok, err, ResultAsync } from 'neverthrow'

// Define specific error types
export class ProfileNotFoundError extends TaggedError('ProfileNotFoundError')<{
  name: string
}> {}

export class ProfileFetchError extends TaggedError('ProfileFetchError')<{
  cause: unknown
}> {}

// Use ResultFn for generator-based composition
export const getProfile = ResultFn(async function* (name: string) {
  const client = yield* safeGetClient()
  
  const profile = yield* ResultAsync.fromPromise(
    fetchProfile(client, name),
    (error) => new ProfileFetchError({ cause: error })
  )
  
  if (!profile) {
    yield* new ProfileNotFoundError({ name })
  }
  
  return ok(profile)
})
```

### Consuming Results

**With TanStack Query** (most common in components):

The `resultQueryOptions` wrapper automatically unwraps Results, so you use standard TanStack Query patterns:

```typescript
// ✅ Standard pattern with TanStack Query
export const ProfileCard = ({ name }: { name: string }) => {
  const { data, isLoading, error } = useQuery(getProfileQueryOptions(name))

  if (isLoading) return <LoadingMessage />

  if (error) {
    // error is the TaggedError instance
    const message = error.cause?.message || error.message || 'Could not load profile'
    return <ErrorMessage title="Profile unavailable" description={message} />
  }

  if (!data) {
    return <ErrorMessage title="Profile unavailable" />
  }

  // data is already unwrapped - use directly!
  return <ProfileView records={data.records} />
}
```

**How `resultQueryOptions` works**:

```typescript
// Internally, resultQueryOptions calls .match() for you:
queryFn: (context) =>
  rawQueryFn(context).match(
    (value) => value,        // Returns unwrapped value → becomes `data`
    (error) => { throw error } // Throws error → becomes `error`
  )
```

**Outside TanStack Query** (in helper functions):

When composing Results in helper functions, use chaining:

```typescript
// ✅ Chaining operations
const finalResult = await getProfile('vitalik.eth')
  .andThen((profile) => validateProfile(profile))
  .andThen((validProfile) => saveProfile(validProfile))
  .map((savedProfile) => formatProfile(savedProfile))

// ✅ Using .match() for final handling
finalResult.match(
  (profile) => console.log('Success:', profile),
  (error) => console.error('Failed:', error.message)
)

// ✅ Early return pattern
if (result.isErr()) {
  console.error('Error:', result.error.message)
  return null
}
const profile = result.value
```

**Checking Result types manually** (rare, when not using TanStack Query):

```typescript
// Only needed outside TanStack Query
const result = yield* getProfile('vitalik.eth')

if (result.isOk()) {
  const canEdit = yield* canEditRecords(result.value)
  return ok(canEdit)
}
```

**In event handlers and mutations** (prefer early returns over `.match()`):

```typescript
// ✅ PREFERRED: Early return pattern
const handleSubmit = async () => {
  const result = await registerUser({ email, name })
  
  if (result.isErr()) {
    console.error('Registration failed:', result.error.message)
    return
  }
  
  console.log('Success:', result.value)
  navigate('/dashboard')
}

// ⚠️ AVOID: .match() in event handlers (feels awkward)
const handleSubmit = async () => {
  const result = await registerUser({ email, name })
  
  result.match(
    (user) => {
      console.log('Success:', user)
      navigate('/dashboard')
    },
    (error) => console.error('Failed:', error)
  )
}

// ✅ ALSO GOOD: try-catch when helper throws
const handleSubmit = async () => {
  try {
    await sendTransaction(params)
    console.log('Success')
  } catch (error) {
    console.error('Failed:', error)
  }
}
```

> **Why avoid `.match()` in handlers?** Early returns and try-catch are more idiomatic for imperative control flow in event handlers. Reserve `.match()` for functional composition in helpers.

### Critical Anti-Patterns

```typescript
// ❌ NEVER manually unwrap Results with throw
ResultAsync.fromPromise(
  helper(...).then((result) => {
    if (result.isErr()) throw result.error  // BAD!
    return result.value
  }),
  (error) => error
)

// ✅ CORRECT - Chain Results directly
return helper(...)  // Just return the ResultAsync

// ❌ NEVER mix try-catch with ResultAsync
try {
  const data = processSync()
  return ResultAsync.fromSafePromise(Promise.resolve(data))
} catch (error) {
  return errAsync(new Error(String(error)))
}

// ✅ CORRECT - Use fromSync for synchronous code that might throw
import { fromSync } from '@ens-apps/utils/neverthrow'

return fromSync(
  () => processSync(),
  (error) => new ProcessError({ cause: error })
)

// ✅ Also correct - Use fromThrowable for reusable sync wrappers
import { fromThrowable } from 'neverthrow'

const safeJsonParse = fromThrowable(
  JSON.parse,
  (error) => new ParseError({ cause: error })
)

const result = safeJsonParse('{"valid": true}') // Result<any, ParseError>

// ✅ Real-world example with fromSync
import { normalize } from 'viem/ens'
import { fromSync } from '@ens-apps/utils/neverthrow'

class NormalizationError extends TaggedError('NormalizationError')<{
  cause: unknown
}> {}

export function normalizeEnsName(name: string): Result<string, NormalizationError> {
  return fromSync(
    () => normalize(name),
    (error) => new NormalizationError({ cause: error })
  )
}
```

### Quick Reference

**Creating Results:**
- `ok(value)` / `err(error)` → for `Result<T, E>` (sync)
- `okAsync(value)` / `errAsync(error)` → for `ResultAsync<T, E>` (async)
- `fromPromise(promise, errorFn)` → wrap async code that might throw
- `fromSync(() => fn(), errorFn)` → wrap sync code that might throw (from `@ens-apps/utils`)
- `fromThrowable(fn, errorFn)` → create reusable sync wrapper (from `neverthrow`)

**Transforming Results:**
- `.andThen(fn)` → chain Results (flatMap)
- `.map(fn)` / `.mapErr(fn)` → transform values/errors
- `.match(onOk, onErr)` → handle both cases

**Advanced Composition:**
- `ResultFn(function* ...)` → generator-based composition with `yield*`
- `yield* new TaggedError(...)` → early error return in ResultFn generators (no need for `return err(...)`)
- `yield* resultFn()` → unwrap Results (no `await` needed, `yield*` handles async)

**Important**: Use `yield*` for Results, not `yield* await`. The `yield*` operator already handles async operations:

```typescript
// ✅ CORRECT - yield* handles async
const profile = yield* ResultAsync.fromPromise(fetchData(), errorFn)
const records = yield* getRecords(params)

// ❌ WRONG - redundant await
const profile = yield* await ResultAsync.fromPromise(fetchData(), errorFn)
```

## Data Fetching with TanStack Query

The codebase uses TanStack Query with a custom `resultQueryOptions` wrapper for `neverthrow` integration.

### Query Structure

```typescript
import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import { useQuery } from '@tanstack/react-query'

// 1. Define error types
export class GetProfileError extends TaggedError('GetProfileError')<{
  cause: unknown
}> {}

// 2. Create the data fetching function
export const getProfile = ResultFn(async function* (name: string) {
  const client = yield* safeGetClient()
  
  const profile = yield* ResultAsync.fromPromise(
    fetchProfile(client, { name }),
    (error) => new GetProfileError({ cause: error })
  )
  
  return ok(profile)
})

// 3. Create query key
export const profileQueryKey = createQueryKey<
  'profile',
  { name: string }
>('profile')

// 4. Create query options factory
export const getProfileQueryOptions = (name: string) =>
  resultQueryOptions({
    queryKey: profileQueryKey({ name }),
    queryFn: ({ queryKey: [, { name }] }) => getProfile(name),
  })
```

**Why no custom hook wrapper?**
- ✅ **Works with all query hooks** - `useQuery`, `useSuspenseQuery`, `useQueries`
- ✅ **Preloading in router loaders** - Can use options directly in `loader`
- ✅ **Customizable per use case** - Add `staleTime`, `enabled`, etc. in component
- ✅ **Simpler types** - No need to handle custom option overrides

### Query Key Patterns 🟡 Default

**Use `createQueryKey` helper for type-safe, invalidation-friendly keys:**

```typescript
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'

// Define query key factory with typed variables
export const profileQueryKey = createQueryKey<
  'profile',
  { name: string }
>('profile')

// Usage
const key = profileQueryKey({ name: 'vitalik.eth' })
// Returns: ['profile', { name: 'vitalik.eth' }] as const
```

**Why object-based params?**

Using a **singular object for query key parameters** enables powerful **partial matching for invalidation**:

```typescript
// Invalidate ALL profile queries
queryClient.invalidateQueries({ queryKey: ['profile'] })

// Invalidate specific profile
queryClient.invalidateQueries({ 
  queryKey: ['profile', { name: 'vitalik.eth' }] 
})

// Partial match - invalidate all profiles on a specific network
queryClient.invalidateQueries({
  predicate: (query) => {
    const [key, params] = query.queryKey as ['profile', { network?: string }]
    return key === 'profile' && params?.network === 'mainnet'
  }
})
```

**Query Key Best Practices:**

1. ✅ **Use `createQueryKey` helper** - Type-safe and consistent ([see implementation](https://github.com/ensdomains/apps-monorepo/blob/main/packages/utils/src/tanstack-query/queryKey.ts))
2. ✅ **Object for params** - Enables partial matching for invalidation
3. ✅ **Named properties** - `{ name }` not just `name`
4. ✅ **Consider scope-based keys** - Group related queries for easier invalidation

```typescript
// ✅ Good - Type-safe, invalidation-friendly
export const recordsQueryKey = createQueryKey<
  'records',
  GetRecordsParameters
>('records')

const key = recordsQueryKey({ name: 'vitalik.eth', texts: true })
// ['records', { name: 'vitalik.eth', texts: true }]

// ❌ Avoid - Positional params, hard to invalidate partially
queryKey: ['records', name, texts]

// ❌ Avoid - Reversed order
queryKey: [name, 'records']
```

> **⚠️ Standardization In Progress**: Query key structure is evolving toward better standardization with scope-based invalidation patterns (e.g., `$qk({ $scope: 'wallet' })` to invalidate all wallet-related queries). The `createQueryKey` helper is the current recommended approach, but standardized key structures and common scopes are being defined to make cross-feature invalidations easier. When defining new query keys, consider how they might be grouped with related queries for bulk invalidation.

### Using Queries in Components

**Standard pattern** - `data` is already unwrapped, use directly:

```typescript
// ✅ Basic usage - data is unwrapped, error is TaggedError
export const ProfileCard = ({ name }: { name: string }) => {
  const { data, isLoading, error } = useQuery(getProfileQueryOptions(name))
  
  if (isLoading) return <LoadingMessage />
  
  if (error) {
    // error is the TaggedError instance
    const message = error.cause?.message || error.message || 'Could not load profile'
    return <ErrorMessage title="Profile unavailable" description={message} />
  }
  
  if (!data) {
    return <ErrorMessage title="Profile unavailable" description="No data returned" />
  }
  
  // data is already unwrapped - use directly!
  return <ProfileDetails records={data.records} />
}

// ✅ With custom options
export const LiveProfileCard = ({ name }: { name: string }) => {
  const { data, isLoading, error } = useQuery({
    ...getProfileQueryOptions(name),
    staleTime: 5000, // Refetch every 5s
    refetchInterval: 5000,
  })
  
  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage title="Error" description={error.message} />
  if (!data) return null
  
  return <ProfileDetails records={data.records} />
}

// ✅ With suspense
export const SuspenseProfileCard = ({ name }: { name: string }) => {
  const { data, error } = useSuspenseQuery(getProfileQueryOptions(name))
  // No loading state needed - suspense handles it
  
  if (error) return <ErrorMessage error={error} />
  if (!data) return null
  
  return <ProfileDetails records={data.records} />
}

// ✅ Multiple queries with useQueries
export const MultiProfileCard = ({ names }: { names: string[] }) => {
  const queries = useQueries({
    queries: names.map(name => getProfileQueryOptions(name)),
  })
  
  return (
    <div>
      {queries.map((q, i) => {
        if (q.isLoading) return <LoadingSpinner key={names[i]} />
        if (q.error) return <ErrorMessage key={names[i]} error={q.error} />
        if (!q.data) return null
        return <ProfileCard key={names[i]} data={q.data} />
      })}
    </div>
  )
}

// ✅ Preloading in router loader
export const Route = createFileRoute('/$name/records')({
  loader: ({ context: { queryClient }, params: { name } }) => {
    return queryClient.prefetchQuery(getProfileQueryOptions(name))
  },
  component: ProfilePage,
})
```

**Key points**:
- ✅ `data` is the **unwrapped value** (not a Result)
- ✅ `error` is the **TaggedError instance** thrown by the query
- ✅ Always check `isLoading`, `error`, and `!data` before using `data`
- ✅ Access error details via `error.cause?.message` or `error.message`

### Avoid Query Waterfalls 🟡 Default

**Don't run dependent queries in the same component** - move them to separate components.

```typescript
// ❌ AVOID - Waterfall queries in same component
export const ProfilePage = ({ name }: { name: string }) => {
  const { data: profile, isLoading: isLoadingProfile, error: profileError } = 
    useQuery(getProfileQueryOptions(name))
  
  // This waits for profile to load before fetching
  const { data: records, isLoading: isLoadingRecords, error: recordsError } = 
    useQuery({
      ...getRecordsQueryOptions(profile?.address),
      enabled: !!profile?.address, // Dependent query
    })
  
  // Now you have 4 states to manage: 2 loading, 2 errors
  if (isLoadingProfile || isLoadingRecords) return <LoadingSpinner />
  if (profileError || recordsError) return <ErrorMessage />
  
  return <div>{/* Complex state management */}</div>
}

// ✅ CORRECT - Split into separate components
export const ProfilePage = ({ name }: { name: string }) => {
  const { data: profile, isLoading, error } = useQuery(getProfileQueryOptions(name))
  
  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage error={error} />
  if (!profile) return null
  
  // Pass profile to child component that handles records
  return <ProfileWithRecords profile={profile} />
}

export const ProfileWithRecords = ({ profile }: { profile: Profile }) => {
  const { data: records, isLoading, error } = useQuery(
    getRecordsQueryOptions(profile.address)
  )
  
  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage error={error} />
  if (!records) return null
  
  return <RecordsView profile={profile} records={records} />
}
```

**Benefits of splitting**:
- ✅ **Clearer state management** - One query per component
- ✅ **Better loading UX** - Show profile while records load
- ✅ **Easier error handling** - Each error is specific to its data
- ✅ **Better composability** - Components are more reusable

### Handle Query States Independently 🟡 Default

**Don't group error or loading states** - handle each query separately.

```typescript
// ❌ AVOID - Grouped loading/error states
export const DashboardPage = () => {
  const { data: profile, isLoading: isLoadingProfile, error: profileError } = 
    useQuery(getProfileQueryOptions())
  const { data: names, isLoading: isLoadingNames, error: namesError } = 
    useQuery(getNamesQueryOptions())
  
  // This hides which data is loading/erroring
  if (isLoadingProfile || isLoadingNames) return <LoadingSpinner />
  if (profileError || namesError) return <ErrorMessage />
  
  return <Dashboard profile={profile} names={names} />
}

// ✅ CORRECT - Handle each query independently
export const DashboardPage = () => {
  const { data: profile, isLoading: isLoadingProfile, error: profileError } = 
    useQuery(getProfileQueryOptions())
  const { data: names, isLoading: isLoadingNames, error: namesError } = 
    useQuery(getNamesQueryOptions())
  
  return (
    <div>
      {/* Show profile section state independently */}
      {isLoadingProfile ? (
        <LoadingSpinner />
      ) : profileError ? (
        <ErrorMessage error={profileError} />
      ) : (
        <ProfileSection profile={profile} />
      )}
      
      {/* Show names section state independently */}
      {isLoadingNames ? (
        <LoadingSpinner />
      ) : namesError ? (
        <ErrorMessage error={namesError} />
      ) : (
        <NamesSection names={names} />
      )}
    </div>
  )
}
```

**Why this matters**:
- ✅ **Different errors mean different things** - Profile error ≠ names error
- ✅ **Show partial data** - Display profile even if names fails
- ✅ **Better UX** - User sees some content immediately
- ✅ **Specific error messages** - Tell user exactly what failed

### Use useQueries for Parallel Queries 🟡 Default

**For multiple parallel queries, use `useQueries`** - cleaner and more concise.

```typescript
// ❌ AVOID - Multiple parallel useQuery calls
export const MultiProfilePage = ({ names }: { names: string[] }) => {
  const profile1 = useQuery(getProfileQueryOptions(names[0]))
  const profile2 = useQuery(getProfileQueryOptions(names[1]))
  const profile3 = useQuery(getProfileQueryOptions(names[2]))
  
  // Verbose state management
  const isLoading = profile1.isLoading || profile2.isLoading || profile3.isLoading
  const errors = [profile1.error, profile2.error, profile3.error].filter(Boolean)
  
  if (isLoading) return <LoadingSpinner />
  if (errors.length > 0) return <ErrorMessage />
  
  return <div>...</div>
}

// ✅ CORRECT - Use useQueries
export const MultiProfilePage = ({ names }: { names: string[] }) => {
  const queries = useQueries({
    queries: names.map(name => getProfileQueryOptions(name)),
  })
  
  return (
    <div>
      {queries.map((query, i) => {
        if (query.isLoading) return <LoadingSpinner key={names[i]} />
        if (query.error) return <ErrorMessage key={names[i]} error={query.error} />
        if (!query.data) return null
        return <ProfileCard key={names[i]} data={query.data} />
      })}
    </div>
  )
}

// ✅ ALSO GOOD - Aggregate states when appropriate
export const MultiProfilePage = ({ names }: { names: string[] }) => {
  const queries = useQueries({
    queries: names.map(name => getProfileQueryOptions(name)),
  })
  
  const isLoading = queries.some(q => q.isLoading)
  const errors = queries.filter(q => q.error).map(q => q.error)
  const allData = queries.every(q => q.data) ? queries.map(q => q.data) : null
  
  if (isLoading) return <LoadingSpinner />
  if (errors.length > 0) return <ErrorList errors={errors} />
  if (!allData) return null
  
  return <ProfileList profiles={allData} />
}
```

**Benefits**:
- ✅ **Less verbose** - One hook instead of many
- ✅ **Dynamic** - Works with variable-length arrays
- ✅ **Type-safe** - Proper TypeScript inference
- ✅ **Consistent pattern** - Standard way to handle parallel queries

### File Organization for Queries

```
features/
└── profile/
    ├── hooks/
    │   ├── useProfile.ts       # getProfile + getProfileQueryOptions
    │   ├── useRecords.ts       # getRecords + getRecordsQueryOptions
    │   └── useSubnames.ts      # getSubnames + getSubnamesQueryOptions
    └── components/
        └── ProfileCard.tsx      # useQuery(getProfileQueryOptions(...))
```

**File naming**: Keep `use*.ts` convention even though they export query options, not hooks. This maintains consistency and groups query-related code in the `hooks/` folder.

## Web3 & Blockchain Patterns

### Contract Interaction Patterns

The codebase follows specific patterns for creating contract interaction helpers. There are two main patterns depending on where the helper lives:

#### Pattern 1: Simple Request Builders (App/Package Level)

For app-specific or package-level contract interactions, create pure functions that return typed request objects:

```typescript
// packages/l2-primary/src/utils/setReverseName.ts

// 1. Define the return type (union if multiple variants)
export type SetReverseNameRequest =
  | {
      address: Address
      abi: typeof l2ReverseRegistrarSetNameForAddrSnippet
      functionName: 'setNameForAddr'
      args: readonly [address: Address, name: string]
    }
  | {
      address: Address
      abi: typeof l2ReverseRegistrarSetNameSnippet
      functionName: 'setName'
      args: readonly [name: string]
    }

// 2. Create the builder function with JSDoc
/**
 * Creates contract call parameters for setting reverse resolution
 * @param params.name - The ENS name to set
 * @param params.reverseRegistrarChainId - The chain ID for the reverse registrar
 * @param params.chain - Optional chain object to determine network
 * @param params.targetAddress - Optional address to set the name for
 * @returns Contract parameters to pass to writeContract
 * @throws Error if no registrar is found for the coin type
 */
export function createSetReverseNameRequest({
  name,
  reverseRegistrarChainId,
  chain,
  targetAddress,
}: {
  name: string
  reverseRegistrarChainId: ReverseRegistrarChainId
  chain?: Chain
  targetAddress?: Address
}): SetReverseNameRequest {
  const network = resolveNetworkFromChain(chain)
  const registrarAddress = getRegistrarAddress(reverseRegistrarChainId, network)
  
  if (!registrarAddress) {
    throw new Error(
      `No registrar found for coin type ${reverseRegistrarChainId} on ${network}`
    )
  }
  
  if (targetAddress) {
    return {
      address: registrarAddress,
      abi: l2ReverseRegistrarSetNameForAddrSnippet,
      functionName: 'setNameForAddr',
      args: [targetAddress, name] as const,
    }
  }
  
  return {
    address: registrarAddress,
    abi: l2ReverseRegistrarSetNameSnippet,
    functionName: 'setName',
    args: [name] as const,
  }
}
```

**Key characteristics:**
- Pure function that returns typed request object
- Returns `{ address, abi, functionName, args }`
- Throws errors for invalid states
- JSDoc explains purpose and caller responsibilities
- Uses `as const` for args to preserve tuple types

#### Pattern 2: ENSjs Package Pattern

For the `@ensdomains/ensjs` package, follow this two-part pattern for writes and single function for reads:

**Read Operations:**

```typescript
// packages/ensjs/src/functions/public/getNameRegistry.ts

// 1. Export type aliases
export type GetNameRegistryAddressParameters = {
  /** The parent registry address */
  registryAddress: Address
  /** The label to look up */
  label: string
}

export type GetNameRegistryAddressReturnType = Address

export type GetNameRegistryAddressErrorType = ReadContractErrorType

// 2. Create the async function
/**
 * Gets the subregistry address from a parent registry.
 *
 * @param client - {@link Client}
 * @param parameters - {@link GetNameRegistryAddressParameters}
 * @returns Address of the subregistry. {@link GetNameRegistryAddressReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { getNameRegistryAddress } from '@ensdomains/ensjs/public'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const address = await getNameRegistryAddress(client, {
 *   registryAddress: '0x...',
 *   label: 'flo',
 * })
 */
export async function getNameRegistryAddress(
  client: Client,
  { registryAddress, label }: GetNameRegistryAddressParameters
): Promise<GetNameRegistryAddressReturnType> {
  ASSERT_NO_TYPE_ERROR(client)
  
  const readContractAction = getAction(client, readContract, 'readContract')
  
  return readContractAction({
    address: registryAddress,
    abi: registryGetSubregistrySnippet,
    functionName: 'getSubregistry',
    args: [label],
  })
}
```

**Write Operations (Two-Part Pattern):**

```typescript
// packages/ensjs/src/functions/wallet/deploySubregistry.ts

// ================================
// Part 1: Write Parameters
// ================================

// 1. Export parameter types
export type DeploySubregistryWriteParametersParameters = {
  factoryAddress: Address
  implAddress: Address
  adminAddress?: Address
  roleBitmap?: bigint
  salt?: bigint
}

export type DeploySubregistryWriteParametersReturnType = ReturnType<
  typeof deploySubregistryWriteParameters
>

export type DeploySubregistryWriteParametersErrorType = 
  EncodeFunctionDataErrorType

// 2. Create the write parameters function
export const deploySubregistryWriteParameters = <
  chain extends Chain,
  account extends Account,
>(
  client: Client<Transport, chain, account>,
  {
    factoryAddress,
    implAddress,
    adminAddress,
    roleBitmap = DEFAULT_ROLE_BITMAP,
    salt = DEFAULT_SALT,
  }: DeploySubregistryWriteParametersParameters
) => {
  ASSERT_NO_TYPE_ERROR(client)
  
  const finalAdminAddress = adminAddress ?? client.account.address
  
  const callData = encodeFunctionData({
    abi: subregistryInitializeSnippet,
    functionName: 'initialize',
    args: [finalAdminAddress, roleBitmap],
  })
  
  return {
    address: factoryAddress,
    abi: verifiableFactoryDeployProxySnippet,
    functionName: 'deployProxy',
    args: [implAddress, salt, callData],
    chain: client.chain,
    account: client.account,
  } as const satisfies WriteContractParameters<
    typeof verifiableFactoryDeployProxySnippet
  >
}

// ================================
// Part 2: Action Function
// ================================

// 3. Export action types
export type DeploySubregistryParameters<
  chain extends Chain,
  account extends Account,
  chainOverride extends Chain | undefined,
> = Prettify<
  DeploySubregistryWriteParametersParameters &
    WriteTransactionParameters<chain, account, chainOverride>
>

export type DeploySubregistryReturnType = Hash

export type DeploySubregistryErrorType =
  | DeploySubregistryWriteParametersErrorType
  | ClientWithOverridesErrorType
  | WriteContractErrorType

// 4. Create the action function
/**
 * Deploys a subregistry contract via a verifiable proxy factory.
 * @param client - {@link Client}
 * @param options - {@link DeploySubregistryParameters}
 * @returns Transaction hash. {@link DeploySubregistryReturnType}
 *
 * @example
 * import { createWalletClient, custom } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { deploySubregistry } from '@ensdomains/ensjs/wallet'
 *
 * const wallet = createWalletClient({
 *   chain: mainnet,
 *   transport: custom(window.ethereum),
 * })
 * const hash = await deploySubregistry(wallet, {
 *   factoryAddress: '0x...',
 *   implAddress: '0x...',
 * })
 */
export async function deploySubregistry<
  chain extends Chain,
  account extends Account,
  chainOverride extends Chain | undefined,
>(
  client: Client<Transport, chain, account>,
  {
    factoryAddress,
    implAddress,
    adminAddress,
    roleBitmap,
    salt,
    ...txArgs
  }: DeploySubregistryParameters<chain, account, chainOverride>
): Promise<DeploySubregistryReturnType> {
  ASSERT_NO_TYPE_ERROR(client)
  
  const writeParameters = deploySubregistryWriteParameters(
    clientWithOverrides(client, txArgs),
    {
      factoryAddress,
      implAddress,
      adminAddress,
      roleBitmap,
      salt,
    }
  )
  
  const writeContractAction = getAction(client, writeContract, 'writeContract')
  return writeContractAction({
    ...writeParameters,
    ...txArgs,
  } as WriteContractParameters)
}
```

**Key characteristics for ENSjs:**
- Three type exports per function: `Parameters`, `ReturnType`, `ErrorType`
- Use `ASSERT_NO_TYPE_ERROR(client)` macro
- Use `getAction(client, action, 'actionName')` pattern
- Write operations split into:
  - `xWriteParameters` - Returns contract params
  - `x` - Executes the transaction
- Comprehensive JSDoc with examples
- Use `satisfies` for type validation

### Using Contract Helpers in Components

#### With wagmi's useWriteContract

```typescript
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { deploySubregistryWriteParameters } from '@ensdomains/ensjs/wallet'

export const DeployButton = () => {
  const { data: walletClient } = useWalletClient()
  const { writeContractAsync, data: txHash, isPending } = useWriteContract()
  
  const { data: receipt, isLoading: isConfirming } = 
    useWaitForTransactionReceipt({ hash: txHash })
  
  const handleDeploy = async () => {
    if (!walletClient) return
    
    // Get contract parameters
    const params = deploySubregistryWriteParameters(walletClient, {
      factoryAddress: FACTORY_ADDRESS,
      implAddress: IMPL_ADDRESS,
    })
    
    // Execute transaction
    await writeContractAsync({
      address: params.address,
      abi: params.abi,
      functionName: params.functionName,
      args: params.args,
    })
  }
  
  return (
    <button onClick={handleDeploy} disabled={isPending || isConfirming}>
      {isPending ? 'Confirm in wallet...' : isConfirming ? 'Confirming...' : 'Deploy'}
    </button>
  )
}
```

#### With Simple Request Builders

```typescript
import { useWriteContract } from 'wagmi'
import { createSetReverseNameRequest } from '@ens-apps/l2-primary/utils'

export const SetPrimaryNameButton = ({ name }: { name: string }) => {
  const { chain } = useConnection()
  const { writeContractAsync } = useWriteContract()
  
  const handleSetPrimaryName = async () => {
    try {
      // Create request
      const request = createSetReverseNameRequest({
        name,
        reverseRegistrarChainId: 60, // ETH
        chain,
      })
      
      // Execute
      const hash = await writeContractAsync(request)
      console.log('Transaction hash:', hash)
    } catch (error) {
      console.error('Failed to set primary name:', error)
    }
  }
  
  return <button onClick={handleSetPrimaryName}>Set Primary Name</button>
}
```

#### Combining Multiple Requests

```typescript
export const SetPrimaryNameFlow = ({ name, address }: Props) => {
  const { data: walletClient } = useWalletClient()
  const { writeContractAsync } = useWriteContract()
  const [reverseHash, setReverseHash] = useState<Hash>()
  const [forwardHash, setForwardHash] = useState<Hash>()
  
  // Step 1: Set reverse resolution
  const setReverse = async () => {
    const request = createSetReverseNameRequest({
      name,
      reverseRegistrarChainId: 60,
    })
    
    const hash = await writeContractAsync(request)
    setReverseHash(hash)
  }
  
  // Step 2: Set forward resolution
  const setForward = async () => {
    const request = createSetForwardResolutionRequest({
      name,
      reverseRegistrarChainId: 60,
      resolverAddress,
      targetAddress: address,
    })
    
    const hash = await writeContractAsync(request)
    setForwardHash(hash)
  }
  
  return (
    <div>
      <button onClick={setReverse}>1. Set Reverse</button>
      <button onClick={setForward} disabled={!reverseHash}>
        2. Set Forward
      </button>
    </div>
  )
}
```

### Contract Helper Pattern Summary

**When to use Simple Request Builders (Pattern 1):**
- ✅ App-specific contract interactions
- ✅ Package-level utilities (like `@ens-apps/l2-primary`)
- ✅ Simpler contracts with straightforward parameters
- ✅ When you need to compose multiple calls
- ✅ When the helper is consumed directly by components

**Example:** `createSetReverseNameRequest`, `createSetForwardResolutionRequest`

**When to use ENSjs Two-Part Pattern (Pattern 2):**
- ✅ Core ENS protocol interactions
- ✅ Functions in `@ensdomains/ensjs` package
- ✅ Operations that benefit from both "get params" and "execute" variants
- ✅ Complex parameter handling with overrides
- ✅ Functions consumed by external developers

**Example:** `deploySubregistryWriteParameters` + `deploySubregistry`

**Key Differences:**

| Aspect             | Simple Builders        | ENSjs Pattern                            |
| ------------------ | ---------------------- | ---------------------------------------- |
| **Structure**      | Single function        | Two functions (writeParameters + action) |
| **Returns**        | Contract params object | writeParameters: params, action: Hash    |
| **Client**         | Not required           | Required (uses `getAction`)              |
| **Type safety**    | `as const` for args    | `satisfies WriteContractParameters`      |
| **JSDoc**          | Basic documentation    | Comprehensive with examples              |
| **Error handling** | Throws directly        | Typed error unions                       |
| **Use case**       | Direct component usage | Library API + component usage            |

### Working with wagmi

**Address / connection hooks (wagmi v3):** Both `useConnection` and `useAccount` return `address`, `chain`, `connector`, `status`, etc. Either hook is valid for getting the connected address. Do not flag `useConnection()` for address—it is correct.

```typescript
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { type Address } from 'viem'

export const TransactionButton = () => {
  // Get account info
  const { address, isConnected, chain } = useAccount()
  
  // Get clients
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  
  // Check connection
  if (!isConnected || !address) {
    return <ConnectWallet />
  }
  
  const handleTransaction = async () => {
    if (!walletClient) return
    
    const result = await prepareTransaction({
      address,
      publicClient,
      walletClient,
    })
    
    // Handle result
  }
  
  return <button onClick={handleTransaction}>Send Transaction</button>
}
```

### Safe Client Access

Use the `safeGetClient` helper for error handling:

```typescript
import { safeGetClient } from '@/lib/wagmi/helpers'
import { ResultFn } from '@ens-apps/utils/neverthrow'

export const getNameOwner = ResultFn(async function* (name: string) {
  // Safely get client with error handling
  const client = yield* safeGetClient()
  
  const owner = yield* ResultAsync.fromPromise(
    getOwner(client, { name }),
    (error) => new GetOwnerError({ cause: error })
  )
  
  return ok(owner)
})
```

### Working with ENS

Always normalize ENS names and import types from ENSjs for proper error handling:

```typescript
import { normalize } from 'viem/ens'
import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { fromPromise, ok } from 'neverthrow'
import {
  getRecords as ensjs_getRecords,
  type GetRecordsErrorType,
  type GetRecordsParameters,
} from '@ensdomains/ensjs/public'
import { safeGetClient } from '@/lib/wagmi/helpers'

// Always normalize ENS names before using them
const normalizedName = normalize('vitalik.eth')

// Define error class with ENSjs error type
class RecordsError extends TaggedError('RecordsError')<{
  cause: GetRecordsErrorType
}> {}

/**
 * Fetches ENS records for a given name.
 * Uses ENSjs types for parameters and errors.
 */
export const getRecords = ResultFn(async function* (
  params: GetRecordsParameters,
) {
  const client = yield* safeGetClient()
  
  // Use fromPromise with proper ENSjs error typing
  const records = yield* fromPromise(
    ensjs_getRecords(client, params),
    (e) => new RecordsError({ cause: e as GetRecordsErrorType }),
  )
  
  return ok(records)
})
```

**Key patterns:**

1. **Import types from ENSjs** - Use `GetRecordsParameters` and `GetRecordsErrorType`
2. **Type error causes** - `TaggedError<{ cause: GetRecordsErrorType }>`
3. **Use `fromPromise`** - Direct import from `neverthrow`, not `ResultAsync.fromPromise`
4. **Alias ENSjs functions** - `getRecords as ensjs_getRecords` to avoid naming conflicts
5. **Always normalize** - Use `normalize()` from `viem/ens` for user input

**Complex example with multiple clients:**

```typescript
import {
  getNameRegistries as ensjsGetNameRegistries,
  type GetNameRegistriesErrorType,
} from '@ensdomains/ensjs/public/v2'

export class NameRegistriesError extends TaggedError('NameRegistriesError')<{
  cause: GetNameRegistriesErrorType | GetEnsOwnerError
}> {}

/**
 * Discovers which registry (L1 or L2) a name exists on.
 * Shows working with multiple clients and conditional logic.
 */
export const getNameRegistries = ResultFn(async function* ({
  network,
  name,
}: GetNameRegistriesParameters) {
  const l1Client = yield* safeGetClient()
  const l2Client = yield* safeGetNamechainSepoliaClient()
  
  if (!network) return ok(null)
  
  if (network === 'sepolia') {
    const registries = yield* fromPromise(
      ensjsGetNameRegistries(l1Client, { name }),
      (e) => new NameRegistriesError({ cause: e as GetNameRegistriesErrorType }),
    )
    return ok({
      registries,
      network: 'sepolia',
      protocolVersion: 'ENSv1',
    } as const)
  }
  
  // ... handle other networks
  return ok(null)
})
```

### BigInt Handling

```typescript
// Use BigInt for all blockchain numeric values
const YEAR_IN_SECONDS = 31536000n
const price = 100000000000000000n // Wei

// Format for display
import { formatEther, formatUnits, parseEther } from 'viem'

const displayPrice = formatEther(price) // "0.1 ETH"
const parsedAmount = parseEther('0.1') // 100000000000000000n

// Always use bigint arithmetic
const totalCost = price * duration / YEAR_IN_SECONDS
const withBuffer = (price * 105n) / 100n // Add 5% buffer
```

### Address Type Safety

```typescript
import { type Address, isAddress } from 'viem'

// Always use Address type
interface ProfileParams {
  address: Address
}

// Validate addresses
function validateAddress(value: string): value is Address {
  return isAddress(value)
}

// Type guard in use
function getProfile(address: string) {
  if (!validateAddress(address)) {
    return err(new InvalidAddressError({ address }))
  }
  
  // TypeScript knows address is Address here
  return fetchProfile(address)
}
```

## Component Composition

### Composition Over Configuration

Build flexible components through composition:

```typescript
// Good - Composition
export const ProfilePage = ({ name }: { name: string }) => {
  const { data: profile } = useQuery(getProfileQueryOptions(name))
  
  return (
    <Card>
      <CardHeader>
        <Avatar src={profile.avatar} />
        <h1>{profile.name}</h1>
      </CardHeader>
      <CardBody>
        <ProfileRecords records={profile.records} />
      </CardBody>
      <CardFooter>
        <Button onClick={handleEdit}>Edit</Button>
      </CardFooter>
    </Card>
  )
}

// Avoid - Configuration props
export const ProfileCard = ({
  profile,
  showAvatar,
  showRecords,
  showEditButton,
  onEdit,
}: ProfileCardProps) => {
  return (
    <div>
      {showAvatar && <Avatar />}
      {showRecords && <Records />}
      {showEditButton && <Button onClick={onEdit} />}
    </div>
  )
}
```

### Using Radix UI Primitives

```typescript
import * as Dialog from '@radix-ui/react-dialog'

// Good - Compose Radix primitives with custom styling
export const EditProfileDialog = ({ children }: { children: React.ReactNode }) => {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button>Edit Profile</button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <Dialog.Title>Edit Profile</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

### Render Props Pattern

```typescript
// Good - Render prop for flexibility
interface DataTableProps<T> {
  data: readonly T[]
  renderRow: (item: T) => React.ReactNode
  renderEmpty?: () => React.ReactNode
}

export const DataTable = <T,>({ data, renderRow, renderEmpty }: DataTableProps<T>) => {
  if (data.length === 0) {
    return renderEmpty?.() ?? <p>No data</p>
  }
  
  return (
    <table>
      <tbody>
        {data.map((item, index) => (
          <tr key={index}>{renderRow(item)}</tr>
        ))}
      </tbody>
    </table>
  )
}

// Usage
<DataTable
  data={profiles}
  renderRow={(profile) => (
    <>
      <td>{profile.name}</td>
      <td>{profile.address}</td>
    </>
  )}
/>
```

## Performance Guidelines

React 19 and our stack are fast by default. **Optimize only when proven necessary.**

### Philosophy (🟢 Guideline)

- **Measure before optimizing** - Use React DevTools Profiler to identify actual bottlenecks
- **Favor clarity over micro-optimizations** - Premature optimization obscures intent
- **Trust React's defaults** - React 19's concurrent features handle most scenarios
- **Optimize for bundle size first** - Smaller bundles → faster initial load

### When to Use Memoization

```typescript
// ❌ Premature optimization - No benefit
export const Button = ({ label }: { label: string }) => {
  const text = useMemo(() => label.toUpperCase(), [label]) // Unnecessary
  return <button>{text}</button>
}

// ✅ Good - Expensive calculation
export const NameValidator = ({ name }: { name: string }) => {
  const isValid = useMemo(() => {
    // Expensive regex or normalization
    return validateENSName(name) // Only recompute when name changes
  }, [name])
  
  return <div>{isValid ? '✓' : '✗'}</div>
}

// ✅ Good - Referential stability for dependencies
export const UserList = () => {
  const filters = useMemo(() => ({ active: true, verified: true }), [])
  const users = useQuery(getUsersQueryOptions(filters)) // Prevents refetch on re-render
  return <div>...</div>
}
```

### When to Use useCallback

```typescript
// ❌ Unnecessary - Simple inline handler
<button onClick={() => setCount(c => c + 1)}>Increment</button>

// ✅ Good - Passed to memoized child
const MemoizedChild = memo(Child)

export const Parent = () => {
  const handleSave = useCallback((data: FormData) => {
    // Save logic
  }, [])
  
  return <MemoizedChild onSave={handleSave} />
}
```

### Performance Checklist

Before optimizing, check these first:

1. **Code splitting** - Use route-based lazy loading with TanStack Router
2. **Bundle analysis** - Remove unused dependencies (`pnpm why <package>`)
3. **Image optimization** - Use WebP, lazy loading, proper sizing
4. **Query management** - Set appropriate `staleTime` and `gcTime` for TanStack Query
5. **Avoid prop drilling** - Use composition instead of passing props through many layers

### Measuring Performance

```typescript
// Use React DevTools Profiler
import { Profiler } from 'react'

<Profiler id="UserList" onRender={(id, phase, actualDuration) => {
  console.log(`${id} (${phase}) took ${actualDuration}ms`)
}}>
  <UserList />
</Profiler>
```

**Key metrics:**
- **Initial render** - Should be < 100ms for most components
- **Re-render time** - Should be < 16ms (60fps)
- **Bundle size** - Keep route chunks under 200KB (gzipped)

## Error Boundaries

### When to Use Error Boundaries (🟡 Default)

Error boundaries catch rendering errors that escape your `Result` types. **They complement, not replace, `neverthrow`.**

```typescript
import { ErrorBoundary } from 'react-error-boundary'

// Route-level error boundary
export const Route = createFileRoute('/$name')({
  component: () => (
    <ErrorBoundary
      fallback={<ErrorFallback />}
      onError={(error, info) => {
        console.error('Rendering error:', error, info)
        // Optional: Send to error tracking service
      }}
    >
      <NamePage />
    </ErrorBoundary>
  ),
})
```

### Error Types

**Result errors (neverthrow) ≠ Rendering errors (Error Boundaries)**

| Error Type                | Handling                          | Example                       |
| ------------------------- | --------------------------------- | ----------------------------- |
| **Data fetching errors**  | `Result<T, E>` + pattern matching | API failure, validation error |
| **Business logic errors** | `Result<T, E>` + early returns    | Invalid input, auth failure   |
| **Rendering errors**      | Error Boundary                    | Component crash, ref error    |
| **Unexpected errors**     | Error Boundary + logging          | Third-party lib bugs          |

### Error Boundary Implementation

```typescript
import { type FallbackProps } from 'react-error-boundary'

const ErrorFallback = ({ error, resetErrorBoundary }: FallbackProps) => {
  return (
    <div role="alert" className="p-4">
      <h2>Something went wrong</h2>
      <pre className="text-sm">{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  )
}

// Use at route or feature level
export const ProfilePage = () => {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <ProfileContent />
    </ErrorBoundary>
  )
}
```

### Best Practices

- ✅ **Use route-level boundaries** - Isolate errors to specific routes
- ✅ **Log errors** - Send to monitoring service (Sentry, LogRocket)
- ✅ **Provide recovery** - Give users a way to retry or navigate away
- ✅ **Never swallow errors** - Always log or display them
- ❌ **Don't use for control flow** - Use `Result` types for expected errors
- ❌ **Don't catch all errors globally** - Granular boundaries are better

## Styling with Tailwind CSS

### Utility-First Approach

```typescript
// Good - Utility classes
export const Button = ({ children }: { children: React.ReactNode }) => {
  return (
    <button className="rounded-sm bg-primary px-4 py-2 text-white hover:bg-primary/90">
      {children}
    </button>
  )
}
```

### Component Variants with CVA

Use `class-variance-authority` for type-safe variants:

```typescript
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-sm font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary text-white hover:bg-primary/90',
        outline: 'border border-input bg-background hover:bg-accent',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 px-3',
        lg: 'h-10 px-6',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

interface ButtonProps 
  extends React.ComponentProps<'button'>,
    VariantProps<typeof buttonVariants> {}

export const Button = ({ className, variant, size, ...props }: ButtonProps) => {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}
```

> **Note**: For complex multi-part components (e.g., Card with separate Header, Body, Footer styles), consider [tailwind-variants](https://www.tailwind-variants.org/) which extends CVA with slots and built-in class merging. For single-part components, CVA + `cn()` is sufficient.

### Conditional Classes and Class Helpers 🟡 Default

**Pick one approach (`clsx`/`cn` or `tw`/`twm`) and use it consistently across the codebase.**

#### Using `clsx` and `cn`

`clsx` merges class names conditionally. `cn` wraps `clsx` with `tailwind-merge` to resolve conflicting Tailwind utilities (e.g., `bg-red-500` vs `bg-blue-500`, `p-2` vs `p-4`).

```typescript
import { cn } from '@/lib/utils'
import clsx from 'clsx'

// Use clsx when you just need to merge classes without Tailwind conflict resolution
const simpleClasses = clsx('text-sm', isActive && 'font-bold')

// Use cn when you need Tailwind conflict resolution
export const Card = ({ isActive, className }: CardProps) => {
  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        isActive && 'border-primary bg-primary/5',
        className
      )}
    >
      ...
    </div>
  )
}
```

**When to use `clsx` vs `cn`:**
- Use `clsx` when you just need to merge classes and don't have conflicting Tailwind utilities
- Use `cn` when composing classes that might conflict (e.g., different padding/margin values, different background colors)

#### Using `tw` and `twm` (Alternative)

`tw` and `twm` are custom utilities that provide a single API for all class name use cases. They handle single strings, template literals, and `clsx`-style function calls, choosing the most efficient method based on input.

```typescript
import { tw, twm } from '@/utils/tailwind'

// tw: Single string (returns directly, no clsx overhead)
<Button className={tw`px-4 py-2`} />

// tw: Tagged template with interpolations
<Button className={tw`px-4 py-2 ${isActive ? 'bg-primary' : ''}`} />

// tw: Function call form (clsx-compatible)
<Button className={tw('px-4 py-2', isActive && 'bg-primary')} />

// twm: Same as tw but with tailwind-merge for conflict resolution
<Button className={twm('px-4 py-2', isActive && 'bg-primary')} />
```

**About `tw` and `twm`:**
- `tw` is a unified utility that handles all use cases: single strings, template literals, and `clsx` function syntax
- **Performance-optimized**: Only invokes `clsx` when there are multiple inputs; single string inputs are returned directly
- Supports all `clsx` features: strings, arrays, objects, conditionals, nested structures
- `twm` adds `twMerge` for Tailwind-aware conflict resolution (equivalent to `cn` but with the same unified API)
- Prefer `tw` by default for the lightest helper; use `twm` when you need conflict resolution

**Note**: Autocomplete is the same for `clsx`, `cn`, `tw`, and `twm` - they're all configured identically in the Tailwind config. The benefit of `tw`/`twm` is the unified API that enables Tailwind autocomplete even for simple string assignments where you'd normally just use a plain string:

```typescript
// No intellisense
const myVar = "text-red-500"

// Intellisense enabled from var name
const className = "text-red-500"

// Intellisense manually enabled (works everywhere)
const myVar = tw`text-red-500`
```

**Benefits of consistency:**
- ✅ **One import** - Team knows where to look
- ✅ **Better IDE support** - Configure once
- ✅ **Easier onboarding** - One pattern to learn
- ✅ **Biome integration** - `useSortedClasses` works with `tw` helper

### Avoid Arbitrary Values 🟡 Default

**Use design system tokens instead of arbitrary values.** Only use arbitrary values when justified.

```typescript
// ❌ AVOID - Arbitrary values break design system
<div className="w-[37px] h-[23px] text-[#3B82F6]" />

// ✅ CORRECT - Use design tokens
<div className="size-9 text-blue-500" />
<div className="w-8 h-6 text-primary" />

// ✅ ACCEPTABLE - When design system doesn't have the value
// Always leave a comment explaining why
<div 
  className="w-[120px]" // Specific width needed to align with external component
/>
```

**Why avoid arbitrary values:**
- ❌ **Breaks consistency** - Diverges from design system
- ❌ **Hard to maintain** - Magic numbers scattered everywhere
- ❌ **No type safety** - Easy to make typos
- ❌ **Larger bundle** - Each arbitrary value adds CSS

**When arbitrary values are justified:**
- ✅ Interfacing with third-party components with fixed dimensions
- ✅ Dynamic values from props/API that can't use tokens
- ✅ One-off exceptions that don't fit the design system (document why!)

**Always ask**: "Could this use a design token instead?"

### Icon Sizing with Lucide

```typescript
import { CalendarIcon } from 'lucide-react'

// Good - Use Tailwind size classes
<CalendarIcon className="size-4" />
<CalendarIcon className="size-3.5" />
<CalendarIcon className="size-6" />

// Avoid - Don't use props
<CalendarIcon width={16} height={16} />
<CalendarIcon size={16} />
```

## Routing with TanStack Router

### File-Based Routing

TanStack Router uses file-based routing:

```
routes/
├── __root.tsx              # Root layout
├── index.tsx               # / route
├── $name.tsx               # /:name route
└── $name/
    ├── records.tsx         # /:name/records
    └── history.tsx         # /:name/history
```

### Route Definition

```typescript
// routes/$name.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$name')({
  // Type-safe params
  validateSearch: (search) => ({
    tab: (search.tab as 'profile' | 'records') || 'profile',
  }),
  
  // Load data before rendering
  loader: async ({ params: { name } }) => {
    return await getProfile(name)
  },
  
  // Component
  component: function NamePage() {
    const { name } = Route.useParams()
    const { tab } = Route.useSearch()
    
    return <div>...</div>
  },
})
```

### Navigation

```typescript
import { Link, useNavigate } from '@tanstack/react-router'

export const Navigation = () => {
  const navigate = useNavigate()
  
  return (
    <nav>
      {/* Type-safe Link */}
      <Link to="/$name" params={{ name: 'vitalik.eth' }}>
        View Profile
      </Link>
      
      {/* Programmatic navigation */}
      <button
        onClick={() => {
          navigate({
            to: '/$name',
            params: { name: 'vitalik.eth' },
            search: { tab: 'records' },
          })
        }}
      >
        Go to Records
      </button>
    </nav>
  )
}
```

## Accessibility

Use WCAG 2 guidelines wherever possible (prefer WCAG 2.2).

Quick references:
- WCAG overview: https://www.w3.org/WAI/standards-guidelines/wcag/
- How to Meet WCAG 2.2 (Quick Reference): https://www.w3.org/WAI/WCAG22/quickref/

### WCAG 2 Examples

#### Focus Visible (WCAG 2.4.7)

Never remove focus styles without a clear replacement. Prefer `:focus-visible` so mouse users don’t get distracting rings.

```typescript
// Good - visible keyboard focus ring
<button
  type="button"
  className="rounded-sm px-3 py-2 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
>
  Save
</button>

// Avoid - removing outlines with no replacement
<button type="button" className="outline-none">
  Save
</button>
```

### Semantic HTML

Use semantic HTML elements:

```typescript
// Good
<nav>
  <ul>
    <li><a href="/">Home</a></li>
  </ul>
</nav>

<main>
  <article>
    <h1>Title</h1>
    <p>Content</p>
  </article>
</main>

// Avoid
<div className="nav">
  <div className="nav-list">
    <div><span onClick={goHome}>Home</span></div>
  </div>
</div>
```

### ARIA Attributes

```typescript
// Good - Accessible button
<button
  type="button"
  aria-label="Close dialog"
  aria-pressed={isPressed}
>
  <XIcon className="size-4" />
</button>

// Good - Accessible form
<form>
  <label htmlFor="name-input">
    ENS Name
  </label>
  <input
    id="name-input"
    type="text"
    aria-describedby="name-help"
    aria-invalid={hasError}
  />
  <p id="name-help">Enter your ENS name</p>
</form>
```

### Keyboard Navigation

Ensure all interactive elements are keyboard accessible:

```typescript
export const MenuItem = ({ onClick }: { onClick: () => void }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      Menu Item
    </button>
  )
}
```

## General TypeScript/JavaScript Coding Guidelines

### Core Patterns

**Use Explaining Variables** - Extract complex expressions into named variables for clarity:

```typescript
// Good
const isEligible = user.age >= 18 && user.hasVerifiedEmail && !user.isBanned
if (isEligible) { /* ... */ }

// Avoid
if (user.age >= 18 && user.hasVerifiedEmail && !user.isBanned) { /* ... */ }
```

**Avoid Magic Values** - Replace magic numbers and strings with named constants:

```typescript
// Good
const SECONDS_PER_YEAR = 31536000n
const MIN_REGISTRATION_DURATION = SECONDS_PER_YEAR

// Avoid
if (duration < 31536000n) { /* ... */ }
```

**Prefer Array Methods** (🟢 Guideline) - Use `map`, `filter`, `reduce` for transformations:

```typescript
// Good - Declarative transformations
const activeUsers = users.filter(user => user.isActive)
const userNames = users.map(user => user.name)
const totalBalance = users.reduce((sum, user) => sum + user.balance, 0n)

// Also Good - Loop with early exit
function findFirstExpired(names: NameRecord[]): NameRecord | null {
  for (const record of names) {
    if (record.expiresAt < Date.now()) return record
  }
  return null
}
```

**Immutable Transformations** - Create new values instead of mutating:

```typescript
// Good
const addItem = <T,>(items: readonly T[], newItem: T) => [...items, newItem]
const updateItem = <T extends { id: string }>(items: readonly T[], id: string, updates: Partial<T>) =>
  items.map(item => item.id === id ? { ...item, ...updates } : item)

// Avoid mutation
items.push(newItem) // ❌
```

## Advanced neverthrow Patterns

### Using ResultFn with Generators

The `ResultFn` wrapper enables generator-based composition with automatic error propagation:

```typescript
import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'

class ValidationError extends TaggedError('VALIDATION_ERROR')<{ field?: string }> {}
class NetworkError extends TaggedError('NETWORK_ERROR')<{ cause?: unknown }> {}

const processUserRegistration = ResultFn(async function* (userData: { email: string; name: string }) {
  // Early error return - TaggedErrors can be yielded directly
  if (!userData.email) {
    yield* new ValidationError({ message: 'Email is required', field: 'email' })
  }
  
  // yield* automatically unwraps Results and propagates errors
  const existingUser = yield* ResultAsync.fromPromise(
    checkUserExists(userData.email),
    (error) => new NetworkError({ message: 'Failed to check user', cause: error })
  )
  
  if (existingUser) {
    yield* new ValidationError({ message: 'User already exists', field: 'email' })
  }
  
  const newUser = yield* ResultAsync.fromPromise(
    createUser(userData),
    (error) => new NetworkError({ message: 'Failed to create user', cause: error })
  )
  
  return ok(newUser)
})
```

**Benefits**: Automatic error propagation, no manual chaining, type-safe, early returns.

**TaggedError yielding**: Since `TaggedError` extends [`YieldableError`](https://github.com/ensdomains/apps-monorepo/blob/main/packages/utils/src/neverthrow/error-classes.ts), you can yield errors directly in generator functions:

```typescript
// Inside ResultFn generators
if (!userData.email) {
  yield* new ValidationError({ message: 'Email is required' })
  // Immediately returns with error - no need for return err(...)
}

// In regular functions (not generators)
function validateData(data: unknown): Result<Data, ValidationError> {
  if (!data) {
    return err(new ValidationError({ message: 'Data is required' }))
    // Use return err() - yield* only works in generators
  }
  return ok(data as Data)
}
```

### Pattern Matching with Tagged Errors

```typescript
import { match } from 'ts-pattern'

const result = await processUserRegistration(userData)

result.match(
  (user) => console.log('Success:', user),
  (error) => match(error)
    .with({ _tag: 'VALIDATION_ERROR' }, (err) => 
      console.log(`Validation failed on ${err.field}: ${err.message}`)
    )
    .with({ _tag: 'NETWORK_ERROR' }, (err) => 
      console.log(`Network error: ${err.message}`)
    )
    .exhaustive()
)
```

### Testing with neverthrow

```typescript
import { assert } from 'vitest'

it('should return validation error for missing email', async () => {
  const result = await processUserRegistration({ email: '', name: 'John' })
  
  assert(result.isErr())
  expect(result.error._tag).toBe('VALIDATION_ERROR')
  expect(result.error.field).toBe('email')
})

it('should create user successfully', async () => {
  const result = await processUserRegistration({ email: 'john@example.com', name: 'John' })
  
  assert(result.isOk())
  expect(result.value.email).toBe('john@example.com')
})
```

## Testing Strategy

### Testing Philosophy

Write code that is easy to test by design:

1. **Pure functions** - Same inputs always produce same outputs
2. **Explicit dependencies** - Pass dependencies as parameters  
3. **Separation of concerns** - Business logic separate from UI
4. **Small, focused functions** - Each function does one thing

### The Testing Pyramid

**Test Distribution:**
- **70% Unit Tests** - Fast, isolated, test pure functions
- **20% Integration Tests** - Test module interactions
- **10% E2E Tests** - Test critical user flows

### Writing Testable Code

**Extract business logic to testable functions:**

```typescript
// ❌ Hard to test - Logic in component
export const RegistrationForm = () => {
  const handleSubmit = async () => {
    if (!email || !email.includes('@')) { alert('Invalid email'); return }
    // Mixed validation, API calls, UI updates...
  }
  return <form onSubmit={handleSubmit}>...</form>
}

// ✅ Testable - Logic extracted
// helpers/registration.helpers.ts
export function validateRegistration(data: { email: string; name: string }): Result<...> {
  if (!data.email || !data.email.includes('@')) {
    return err(new ValidationError({ message: 'Invalid email', field: 'email' }))
  }
  return ok(data)
}

export const registerUser = ResultFn(async function* (data) {
  const validated = yield* validateRegistration(data)
  const user = yield* ResultAsync.fromPromise(api.register(validated), ...)
  return ok(user)
})

// Component is now thin
export const RegistrationForm = () => {
  const handleSubmit = async () => {
    const result = await registerUser({ email, name })
    
    // Early return pattern (preferred)
    if (result.isErr()) {
      onError(result.error)
      return
    }
    
    onSuccess(result.value)
  }
  return <form onSubmit={handleSubmit}>...</form>
}
```

**Test in isolation:**

```typescript
describe('validateRegistration', () => {
  it('should validate correct data', () => {
    const result = validateRegistration({ email: 'john@example.com', name: 'John' })
    assert(result.isOk())
  })
  
  it('should reject invalid email', () => {
    const result = validateRegistration({ email: 'invalid', name: 'John' })
    assert(result.isErr())
    expect(result.error.field).toBe('email')
  })
})
```

**Dependency Injection** - Pass dependencies as parameters for easy mocking:

```typescript
// ✅ Easy to test
async function getUser(id: string, deps: { database: Database; cache: Cache }) {
  const cached = deps.cache.get(`user:${id}`)
  if (cached) return ok(cached)
  return ResultAsync.fromPromise(deps.database.users.findById(id), ...)
}

// Test with mocks
it('should return cached user', async () => {
  const mockCache = { get: vi.fn().mockReturnValue({ id: '1' }), set: vi.fn() }
  const result = await getUser('1', { database: mockDb, cache: mockCache })
  assert(result.isOk())
})
```

### Test Examples

**Unit Tests** - Test pure functions with Result types:

```typescript
describe('calculateRenewalPrice', () => {
  it('should calculate price for 1 year', async () => {
    const result = await calculateRenewalPrice('vitalik.eth', YEAR_IN_SECONDS)
    assert(result.isOk())
    expect(result.value).toBeGreaterThan(0n)
  })
  
  it('should handle invalid names', async () => {
    const result = await calculateRenewalPrice('', YEAR_IN_SECONDS)
    assert(result.isErr())
    expect(result.error).toBeInstanceOf(InvalidNameError)
  })
})
```

**Component Tests** - Test from user's perspective:

```typescript
describe('ProfileCard', () => {
  it('should display profile information', async () => {
    render(<ProfileCard name="vitalik.eth" />)
    await waitFor(() => expect(screen.getByText('vitalik.eth')).toBeInTheDocument())
  })
  
  it('should handle edit button click', async () => {
    const onEdit = vi.fn()
    render(<ProfileCard name="vitalik.eth" onEdit={onEdit} />)
    await userEvent.click(screen.getByRole('button', { name: /edit/i }))
    expect(onEdit).toHaveBeenCalledTimes(1)
  })
})
```

### What to Test

**✅ DO Test:**
- Business logic (pure functions, calculations)
- Error handling (all error paths with neverthrow)
- Edge cases (empty arrays, null/undefined, boundaries)
- User interactions (clicks, form submissions)
- State transitions (XState machines)

**❌ DON'T Test:**
- Third-party libraries
- Implementation details
- Styling/visual appearance
- Constants
- Type checking (TypeScript does this)

## Code Formatting & Linting with Biome

### Why Biome?

Biome is a fast, unified toolchain for formatting and linting. It replaces ESLint and Prettier with a single tool:

- **Fast**: Written in Rust, 10-100x faster than ESLint
- **Unified**: One tool for formatting and linting
- **Zero config**: Works out of the box with sensible defaults
- **Import sorting**: Built-in `organizeImports` feature
- **IDE support**: First-class support in VSCode/Cursor

### Biome Configuration

Project uses Biome for formatting and linting. See `biome.jsonc` in the root.

**Key Settings:**
- **Formatter**: 2 spaces, single quotes, semicolons as needed
- **Linter**: All recommended rules + custom a11y rules
- **Auto-organize imports**: Enabled

### Formatting Rules

- **Indentation**: 2 spaces
- **Quotes**: Single quotes
- **Semicolons**: As needed (ASI-safe)
- **Import Organization**: Automatic (type imports → external → internal)

```typescript
// Format example
const name = 'vitalik.eth'
const config = { timeout: 5000, retries: 3 }

// Imports auto-organized
import type { Address } from 'viem'
import { formatEther } from 'viem'
import { useAccount } from 'wagmi'

import { Button } from '@/components/ui/button'
```

### Key Linting Rules

| Rule                           | Purpose                                       | Fix                               |
| ------------------------------ | --------------------------------------------- | --------------------------------- |
| `noExplicitAny`                | Avoid `any` types                             | Use `unknown` + type guards       |
| `noNonNullAssertion`           | Avoid `!` operator                            | Use `?.` or type guards           |
| `useButtonType`                | Explicit button types                         | Add `type="button"`               |
| `useKeyWithClickEvents`        | Keyboard accessibility                        | Add `onKeyDown` or use `<button>` |
| `noNestedComponentDefinitions` | Don't nest components                         | Define outside parent             |
| `noForEach`                    | Prefer `for...of` loops over `Array.forEach`  | Use `for...of`                    |
| `noUselessElse`                | Avoid unnecessary else blocks after returns   | Prefer early returns              |
| `noUnusedTemplateLiteral`      | Avoid template literals without interpolation | Use regular strings               |
| `noNegationElse`               | Avoid negated conditions with else branches   | Invert the condition              |

### Running Biome

```bash
pnpm biome check --write .  # Format + lint + fix
pnpm biome format --write . # Format only
```

### IDE Setup

Install Biome extension and set as default formatter. Enable format-on-save and organize imports.

### Ignoring Biome Rules

Use sparingly for legitimate cases:

```typescript
// Ignore specific line
// biome-ignore lint/suspicious/noExplicitAny: Third-party types unavailable
const data: any = externalLibrary.getData()
```

**When to ignore**: Third-party type issues, generated files, documented edge cases  
**When NOT to ignore**: To avoid fixing real issues, skip proper typing, suppress a11y warnings

## Summary

### Golden Rules

#### Architecture & Design

1. **Keep React thin** - Components for UI, not business logic (🔴 Must)
2. **Co-locate code** - Keep files next to their usage (🟢 Guideline)
3. **Be explicit** - Make data flow and dependencies clear (🟡 Default)
4. **Separation of concerns** - Business logic separate from presentation (🔴 Must)
5. **File naming conventions** - Use `*.handlers.ts`, `*.machine.ts`, `*.mock.ts` (🟡 Default)
6. **Mock data policy** - All mocks in `*.mock.ts` files, gated by dev flags (🟡 Default)

#### TypeScript & Code Quality

7. **Type everything** - Leverage TypeScript's strict mode (🔴 Must)
8. **No `any` types** - Use `unknown` or `Record<string, unknown>` for type-safe handling (🔴 Must)
9. **Use generics** - Preserve type information in utility functions (🟡 Default)
10. **Use readonly** - Enforce immutability at type level (🟡 Default)
11. **Discriminated unions** - For state management and variants (🟡 Default)

#### Functional Programming

12. **Pure functions** - Same input → same output, no side effects (🟡 Default)
13. **Immutability** - Transform data, don't mutate (🔴 Must)
14. **Prefer array methods** - Use `map`, `filter`, `reduce` (🟢 Guideline)
15. **Composition** - Build complex operations from simple ones (🟡 Default)

#### Error Handling

16. **Use neverthrow** - Functional error handling with `Result` types (🔴 Must)
17. **TaggedError classes** - For discriminated error unions (🟡 Default)
18. **ResultFn generators** - For clean error composition (🟡 Default)
19. **Never mix Result with try-catch** - Choose one approach (🔴 Must)

#### React Patterns

20. **Never useEffect for data fetching** - Always use TanStack Query (🔴 Must)
21. **Extract effects** - Extract `useEffect` in components to custom hooks (🟡 Default, ≤5 lines OK)
22. **Pattern match** - Use ts-pattern over conditionals (🟡 Default)
23. **Custom hooks for APIs** - Only for DOM/framework APIs, not business logic (🟡 Default)
24. **Component composition** - Build flexible UIs with composition (🟢 Guideline)
25. **Avoid prop drilling** - Use hooks/context for app state, props for local data (🟡 Default)

#### State Management & Data Fetching

26. **React state for UI** - Forms, toggles, simple caching
27. **XState for workflows** - Complex multi-step flows
28. **TanStack Query for async data** - Don't reinvent loading/error states with useState (🟡 Default)
29. **Avoid query waterfalls** - Split dependent queries into separate components (🟡 Default)
30. **Handle query states independently** - Don't group loading/error states with `||` (🟡 Default)
31. **Use useQueries for parallel queries** - More concise than multiple useQuery calls (🟡 Default)
32. **Object-based query keys** - Use singular object for params to enable partial invalidation (🟡 Default)

#### Web3 & Contracts

33. **Simple request builders** - For app-level contract helpers (🟡 Default)
34. **ENSjs two-part pattern** - For library-level contract functions (🟡 Default)
35. **Safe client access** - Use `safeGetClient` helper (🟡 Default)
36. **BigInt for blockchain values** - All numeric blockchain values (🔴 Must)
37. **Instantiate clients once** - Never create clients inside components (🔴 Must)
38. **Define contracts once** - Contract address + ABI in one place (🟡 Default)
39. **Use wagmi hooks for reads** - In React components, never call contracts directly (🟡 Default)

#### Testing & Quality

40. **Write testable code** - Pure functions with explicit dependencies (🟡 Default)
41. **Test business logic** - Unit test pure functions thoroughly (🟡 Default)
42. **Test user behavior** - Component tests from user perspective (🟡 Default)
43. **70/20/10 test distribution** - Unit/Integration/E2E (🟢 Guideline)

#### Performance & Reliability

44. **Measure before optimizing** - Use React DevTools Profiler (🟢 Guideline)
45. **Avoid premature memoization** - Only memoize when proven necessary (🟢 Guideline)
46. **Route-level error boundaries** - Catch rendering errors (🟡 Default)
47. **Result errors ≠ rendering errors** - Use both neverthrow and error boundaries (🟡 Default)

#### Styling & UI

48. **Choose one class helper** - Use `cn` or `tw` consistently (🟡 Default)
49. **Avoid arbitrary values** - Use design tokens, not `w-[37px]` (🟡 Default)

#### Code Formatting

50. **Use Biome** - Format and lint with one tool (🔴 Must)
51. **Single quotes** - For string literals (🟢 Guideline)
52. **2-space indentation** - Consistent formatting (🟢 Guideline)
53. **Organize imports** - Let Biome handle import sorting (🟢 Guideline)

### Decision Framework

Ask yourself these questions when writing code:

#### Separation of Concerns
- Can this logic work outside React? → **Extract to helper function**
- Does this have side effects? → **Use `useEffect` in custom hook**
- Is this testable in isolation? → **Extract to pure function**

#### State Management
- Is this async data fetching? → **Use TanStack Query, not useState**
- Is this UI state or business state? → **React state vs XState**
- Does this need to be cached? → **Use TanStack Query**
- Is this a multi-step flow? → **Use XState machine**
- Creating a query key? → **Use `createQueryKey` with object params for easy invalidation**

#### Type Safety
- Am I using `any`? → **Use `unknown` or proper types**
- Can this fail? → **Return `Result` type**
- Are there multiple variants? → **Use discriminated union**

#### Code Clarity
- Am I hiding complexity? → **Make it explicit**
- Is the data flow clear? → **Add types and explaining variables**
- Will new developers understand this? → **Document intent with names**

#### Error Handling
- Can this operation fail? → **Return `Result` type**
- Do I need multiple error types? → **Use `TaggedError` classes**
- Am I composing multiple operations? → **Use `ResultFn` generator**

#### Testing
- Is this easy to test? → **Extract dependencies, use pure functions**
- What's the user impact? → **Focus tests on behavior**
- Can I mock this? → **Pass dependencies as parameters**

#### Accessibility
- Can keyboard users access this? → **Add keyboard handlers**
- Is this element semantic? → **Use proper HTML elements**
- Are labels associated? → **Connect labels to inputs**

### Common Pitfalls to Avoid

#### ❌ Anti-Patterns

1. **Business logic in components** - Extract to helpers
2. **Data fetching in useEffect** - Use TanStack Query
3. **Naked `useEffect` in components** - Create custom hooks
4. **Query waterfalls in one component** - Split into separate components
5. **Grouping query loading/error states** - Handle independently
6. **Using `any` type** - Use `unknown` or `Record<string, unknown>`
7. **Losing type information** - Use generics to preserve types
8. **Mutating data** - Use immutable transformations
9. **Mixing Result with try-catch** - Choose one approach
10. **Non-null assertions (`!`)** - Use type guards or optional chaining
11. **Complex nested conditionals** - Use pattern matching
12. **Magic numbers and strings** - Extract to named constants
13. **Direct dependency imports** - Use dependency injection
14. **Testing implementation details** - Test user behavior

#### ✅ Best Practices

1. **Pure, testable functions** - Explicit inputs and outputs
2. **Discriminated unions** - For type-safe state management
3. **ResultFn generators** - For error composition
4. **Pattern matching** - For conditional logic
5. **Component composition** - Build flexible UIs
6. **Explaining variables** - Clarify complex expressions
7. **readonly modifiers** - Enforce immutability
8. **Custom error classes** - Tagged errors for pattern matching
9. **Dependency injection** - Pass dependencies as parameters
10. **User-centric tests** - Test from user's perspective

## References

### Core Concepts

- **Functional-Light JS**: [GitHub - getify/Functional-Light-JS](https://github.com/getify/Functional-Light-JS)
- **Clean Code JavaScript**: [GitHub - ryanmcdermott/clean-code-javascript](https://github.com/ryanmcdermott/clean-code-javascript)
- **SOLID Principles in TypeScript**: [LogRocket Blog](https://blog.logrocket.com/applying-solid-principles-typescript/)

### Libraries & Tools

- **React 19**: [react.dev](https://react.dev)
- **TypeScript**: [typescriptlang.org](https://www.typescriptlang.org/)
- **TanStack Query**: [tanstack.com/query](https://tanstack.com/query/latest)
- **TanStack Router**: [tanstack.com/router](https://tanstack.com/router/latest)
- **XState**: [stately.ai/docs/xstate](https://stately.ai/docs/xstate)
- **neverthrow**: [github.com/supermacro/neverthrow](https://github.com/supermacro/neverthrow)
- **wagmi**: [wagmi.sh](https://wagmi.sh/)
- **viem**: [viem.sh](https://viem.sh/)
- **Tailwind CSS**: [tailwindcss.com](https://tailwindcss.com/)
- **Shadcn UI**: [ui.shadcn.com](https://ui.shadcn.com/)
- **Radix UI**: [radix-ui.com](https://www.radix-ui.com/)
- **Biome**: [biomejs.dev](https://biomejs.dev/)

### Internal Documentation

- `CLAUDE.md` - Main development guidelines
- `docs/CODING_GUIDELINES.md` - Coding philosophy
- `packages/transaction-manager/docs/` - Transaction flow architecture

---

*This style guide is a living document. As the ENS Portal evolves, so should these guidelines. When in doubt, follow existing patterns in the codebase and prioritize clarity and maintainability.*
