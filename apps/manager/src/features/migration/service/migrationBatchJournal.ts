import type { Address, Hex } from 'viem'

const JOURNAL_VERSION = 1 as const
const STORAGE_KEY =
  'ens-apps:atomic-hca-migration:submitted-batches:v1:8d1c893' as const

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type MigrationBatchJournalScope = {
  readonly chainId: number
  readonly owner: Address
  readonly hca: Address
}

export type SubmittedAtomicMigrationBatch = {
  readonly intentId: string
  readonly hash: Hex
  readonly names: readonly string[]
}

export type PendingAtomicMigrationIntent = {
  readonly id: string
  readonly names: readonly string[]
}

type StoredEntry = {
  readonly scope: string
  readonly intents: readonly PendingAtomicMigrationIntent[]
  readonly submissions: readonly SubmittedAtomicMigrationBatch[]
}

type StoredJournal = {
  readonly version: typeof JOURNAL_VERSION
  readonly entries: readonly StoredEntry[]
}

export class MigrationBatchJournalCorruptError extends Error {
  constructor(cause?: unknown) {
    super(
      'The submitted migration transaction journal is unreadable. Refusing to continue without retry state.',
      { cause },
    )
    this.name = 'MigrationBatchJournalCorruptError'
  }
}

export class MigrationBatchJournalUnavailableError extends Error {
  constructor() {
    super(
      'Submitted migration transaction storage is unavailable. Refusing to continue without retry protection.',
    )
    this.name = 'MigrationBatchJournalUnavailableError'
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isTransactionHash = (value: unknown): value is Hex =>
  typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value)

const parseSubmission = (
  value: unknown,
): SubmittedAtomicMigrationBatch | null => {
  if (
    !isRecord(value) ||
    typeof value.intentId !== 'string' ||
    value.intentId.length === 0 ||
    !isTransactionHash(value.hash)
  ) {
    return null
  }
  if (
    !Array.isArray(value.names) ||
    value.names.length === 0 ||
    !value.names.every((name) => typeof name === 'string' && name.length > 0)
  ) {
    return null
  }
  return {
    intentId: value.intentId,
    hash: value.hash,
    names: [...new Set(value.names)],
  }
}

const parseIntent = (value: unknown): PendingAtomicMigrationIntent | null => {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    value.id.length === 0
  ) {
    return null
  }
  if (
    !Array.isArray(value.names) ||
    value.names.length === 0 ||
    !value.names.every((name) => typeof name === 'string' && name.length > 0)
  ) {
    return null
  }
  return { id: value.id, names: [...new Set(value.names)] }
}

const scopeKey = (scope: MigrationBatchJournalScope): string =>
  `${scope.chainId}:${scope.owner.toLowerCase()}:${scope.hca.toLowerCase()}`

const getBrowserStorage = (): StorageLike | null => {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

const emptyJournal = (): StoredJournal => ({
  version: JOURNAL_VERSION,
  entries: [],
})

const readJournal = (storage: StorageLike | null): StoredJournal => {
  if (!storage) throw new MigrationBatchJournalUnavailableError()
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return emptyJournal()
    const parsed = JSON.parse(raw) as unknown
    if (
      !isRecord(parsed) ||
      parsed.version !== JOURNAL_VERSION ||
      !Array.isArray(parsed.entries)
    ) {
      throw new MigrationBatchJournalCorruptError()
    }

    const entries = parsed.entries.map((entry): StoredEntry => {
      if (
        !isRecord(entry) ||
        typeof entry.scope !== 'string' ||
        (entry.intents !== undefined && !Array.isArray(entry.intents)) ||
        !Array.isArray(entry.submissions)
      ) {
        throw new MigrationBatchJournalCorruptError()
      }
      const submissions = [
        ...new Map(
          entry.submissions.map((submission) => {
            const parsedSubmission = parseSubmission(submission)
            if (!parsedSubmission) {
              throw new MigrationBatchJournalCorruptError()
            }
            return [
              parsedSubmission.hash.toLowerCase(),
              parsedSubmission,
            ] as const
          }),
        ).values(),
      ]
      const intents = [
        ...new Map(
          (entry.intents ?? []).map((intent) => {
            const parsedIntent = parseIntent(intent)
            if (!parsedIntent) {
              throw new MigrationBatchJournalCorruptError()
            }
            return [parsedIntent.id, parsedIntent] as const
          }),
        ).values(),
      ]
      if (submissions.length === 0 && intents.length === 0) {
        throw new MigrationBatchJournalCorruptError()
      }
      return { scope: entry.scope, intents, submissions }
    })
    return { version: JOURNAL_VERSION, entries }
  } catch (cause) {
    if (cause instanceof MigrationBatchJournalCorruptError) throw cause
    throw new MigrationBatchJournalCorruptError(cause)
  }
}

const writeJournal = (
  storage: StorageLike | null,
  journal: StoredJournal,
): void => {
  if (!storage) throw new MigrationBatchJournalUnavailableError()
  if (journal.entries.length === 0) {
    storage.removeItem(STORAGE_KEY)
    return
  }
  storage.setItem(STORAGE_KEY, JSON.stringify(journal))
}

export const loadSubmittedAtomicMigrationBatches = (
  scope: MigrationBatchJournalScope,
  storage: StorageLike | null = getBrowserStorage(),
): readonly SubmittedAtomicMigrationBatch[] => {
  const key = scopeKey(scope)
  return (
    readJournal(storage).entries.find((entry) => entry.scope === key)
      ?.submissions ?? []
  )
}

export const loadPendingAtomicMigrationIntents = (
  scope: MigrationBatchJournalScope,
  storage: StorageLike | null = getBrowserStorage(),
): readonly PendingAtomicMigrationIntent[] => {
  const key = scopeKey(scope)
  return (
    readJournal(storage).entries.find((entry) => entry.scope === key)
      ?.intents ?? []
  )
}

export const persistPendingAtomicMigrationIntent = (
  scope: MigrationBatchJournalScope,
  intent: PendingAtomicMigrationIntent,
  storage: StorageLike | null = getBrowserStorage(),
): void => {
  const journal = readJournal(storage)
  const key = scopeKey(scope)
  const current = journal.entries.find((entry) => entry.scope === key)
  const intents = [
    ...new Map(
      [...(current?.intents ?? []), intent].map((entry) => [entry.id, entry]),
    ).values(),
  ]
  writeJournal(storage, {
    version: JOURNAL_VERSION,
    entries: [
      ...journal.entries.filter((entry) => entry.scope !== key),
      {
        scope: key,
        intents,
        submissions: current?.submissions ?? [],
      },
    ],
  })
}

export const removePendingAtomicMigrationIntent = (
  scope: MigrationBatchJournalScope,
  intentId: string,
  storage: StorageLike | null = getBrowserStorage(),
): void => {
  const journal = readJournal(storage)
  const key = scopeKey(scope)
  const current = journal.entries.find((entry) => entry.scope === key)
  const intents =
    current?.intents.filter((intent) => intent.id !== intentId) ?? []
  const submissions = current?.submissions ?? []
  writeJournal(storage, {
    version: JOURNAL_VERSION,
    entries: [
      ...journal.entries.filter((entry) => entry.scope !== key),
      ...(intents.length > 0 || submissions.length > 0
        ? [{ scope: key, intents, submissions }]
        : []),
    ],
  })
}

export const persistSubmittedAtomicMigrationBatch = (
  scope: MigrationBatchJournalScope,
  submission: SubmittedAtomicMigrationBatch,
  storage: StorageLike | null = getBrowserStorage(),
): void => {
  const journal = readJournal(storage)
  const key = scopeKey(scope)
  const current = journal.entries.find((entry) => entry.scope === key)
  const existing = current?.submissions ?? []
  const submissions = [
    ...new Map(
      [...existing, submission].map((entry) => [
        entry.hash.toLowerCase(),
        entry,
      ]),
    ).values(),
  ]
  writeJournal(storage, {
    version: JOURNAL_VERSION,
    entries: [
      ...journal.entries.filter((entry) => entry.scope !== key),
      { scope: key, intents: current?.intents ?? [], submissions },
    ],
  })
}

export const removeSubmittedAtomicMigrationBatch = (
  scope: MigrationBatchJournalScope,
  hash: Hex,
  storage: StorageLike | null = getBrowserStorage(),
): void => {
  const journal = readJournal(storage)
  const key = scopeKey(scope)
  const current = journal.entries.find((entry) => entry.scope === key)
  const submissions =
    current?.submissions.filter(
      (submission) => submission.hash.toLowerCase() !== hash.toLowerCase(),
    ) ?? []
  const intents = current?.intents ?? []
  writeJournal(storage, {
    version: JOURNAL_VERSION,
    entries: [
      ...journal.entries.filter((entry) => entry.scope !== key),
      ...(submissions.length > 0 || intents.length > 0
        ? [{ scope: key, intents, submissions }]
        : []),
    ],
  })
}
