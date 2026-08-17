import { logger } from '@ens-apps/utils/logger'
import { type IDBPDatabase, openDB } from 'idb'
import type { Hash } from 'viem'

const DB_NAME = 'ens-transaction-manager'
const DB_VERSION = 1
const ACTIVE_STORE = 'active-transactions'
const HISTORY_STORE = 'transaction-history'
const MAX_HISTORY_SIZE = 1000

// Storage type markers
const STORAGE_TYPE_KEY = 'ens-tx-storage-type'
type StorageType = 'indexeddb' | 'localstorage' | 'memory'

export interface PersistedTransaction {
  id: string
  hash?: Hash
  state: string
  context: unknown
  timestamp: number
  updatedAt: number
}

/**
 * In-memory fallback storage (used when IndexedDB and localStorage are unavailable)
 */
const memoryStorage = {
  active: new Map<string, PersistedTransaction>(),
  history: new Map<string, PersistedTransaction>(),
}

/**
 * Storage manager that determines which storage backend to use
 */
class StorageManager {
  private storageType: StorageType | null = null
  private db: IDBPDatabase | null = null

  /**
   * Initialize and detect available storage
   */
  async init(): Promise<StorageType> {
    // Check if we already determined the storage type
    if (this.storageType) {
      return this.storageType
    }

    // Try to read which storage type is currently in use
    const existingType = this.getStorageTypeMarker()
    if (existingType) {
      this.storageType = existingType

      if (existingType === 'indexeddb') {
        try {
          this.db = await this.initIndexedDB()
          return 'indexeddb'
        } catch (_error) {
          logger.warn('IndexedDB marked but unavailable, migrating')
          // Fall through to try other storage
        }
      } else if (existingType === 'localstorage') {
        if (this.isLocalStorageAvailable()) {
          return 'localstorage'
        }
        logger.warn('localStorage marked but unavailable, migrating')
      }
    }

    // No existing storage or it failed - try in priority order

    // Try IndexedDB first
    try {
      this.db = await this.initIndexedDB()
      this.storageType = 'indexeddb'
      this.setStorageTypeMarker('indexeddb')
      return 'indexeddb'
    } catch (error) {
      logger.warn('IndexedDB unavailable', error)
    }

    // Try localStorage second
    if (this.isLocalStorageAvailable()) {
      this.storageType = 'localstorage'
      this.setStorageTypeMarker('localstorage')
      return 'localstorage'
    }

    // Fall back to memory storage
    this.storageType = 'memory'
    logger.warn('Using in-memory transaction storage (data will not persist)')
    return 'memory'
  }

  /**
   * Initialize IndexedDB database
   */
  private async initIndexedDB(): Promise<IDBPDatabase> {
    return openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Store for active/pending transactions
        if (!db.objectStoreNames.contains(ACTIVE_STORE)) {
          const activeStore = db.createObjectStore(ACTIVE_STORE, {
            keyPath: 'id',
          })
          activeStore.createIndex('state', 'state')
          activeStore.createIndex('timestamp', 'timestamp')
        }

        // Store for transaction history
        if (!db.objectStoreNames.contains(HISTORY_STORE)) {
          const historyStore = db.createObjectStore(HISTORY_STORE, {
            keyPath: 'id',
          })
          historyStore.createIndex('timestamp', 'timestamp')
          historyStore.createIndex('state', 'state')
        }
      },
    })
  }

  /**
   * Check if localStorage is available
   */
  private isLocalStorageAvailable(): boolean {
    try {
      const test = '__storage_test__'
      localStorage.setItem(test, test)
      localStorage.removeItem(test)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get the storage type marker (from memory or localStorage)
   */
  private getStorageTypeMarker(): StorageType | null {
    try {
      // Try memory first (fastest)
      if (this.storageType) return this.storageType

      // Try localStorage
      const stored = localStorage.getItem(STORAGE_TYPE_KEY)
      return stored as StorageType | null
    } catch {
      return null
    }
  }

  /**
   * Set the storage type marker
   */
  private setStorageTypeMarker(type: StorageType): void {
    try {
      localStorage.setItem(STORAGE_TYPE_KEY, type)
    } catch {
      // localStorage unavailable, that's ok
    }
  }

  /**
   * Get the current storage type
   */
  async getStorageType(): Promise<StorageType> {
    if (!this.storageType) {
      await this.init()
    }
    // biome-ignore lint/style/noNonNullAssertion: storageType guaranteed to be set after init()
    return this.storageType!
  }

  /**
   * Save transaction using current storage backend
   */
  async save(id: string, transaction: PersistedTransaction): Promise<void> {
    const type = await this.getStorageType()
    const data = { ...transaction, id, updatedAt: Date.now() }

    switch (type) {
      case 'indexeddb':
        if (!this.db) throw new Error('IndexedDB not initialized')
        await this.db.put(ACTIVE_STORE, data)
        break

      case 'localstorage':
        localStorage.setItem(
          `tx-${id}`,
          JSON.stringify(data, (_key, value) =>
            typeof value === 'bigint' ? { __bigint: value.toString() } : value,
          ),
        )
        break

      case 'memory':
        memoryStorage.active.set(id, data)
        break
    }
  }

  /**
   * Get transaction using current storage backend
   */
  async get(id: string): Promise<PersistedTransaction | null> {
    const type = await this.getStorageType()

    switch (type) {
      case 'indexeddb':
        if (!this.db) return null
        return (await this.db.get(ACTIVE_STORE, id)) || null

      case 'localstorage': {
        const data = localStorage.getItem(`tx-${id}`)
        return data
          ? JSON.parse(data, (_key, value) =>
              value && typeof value === 'object' && '__bigint' in value
                ? BigInt(value.__bigint)
                : value,
            )
          : null
      }

      case 'memory':
        return memoryStorage.active.get(id) || null

      default:
        return null
    }
  }

  /**
   * Get all active transactions
   */
  async getAll(): Promise<PersistedTransaction[]> {
    const type = await this.getStorageType()

    switch (type) {
      case 'indexeddb':
        if (!this.db) return []
        return await this.db.getAll(ACTIVE_STORE)

      case 'localstorage': {
        const keys = Object.keys(localStorage).filter((k) =>
          k.startsWith('tx-'),
        )
        return keys
          .map((k) => {
            const data = localStorage.getItem(k)
            return data
              ? JSON.parse(data, (_key, value) =>
                  value && typeof value === 'object' && '__bigint' in value
                    ? BigInt(value.__bigint)
                    : value,
                )
              : null
          })
          .filter(Boolean) as PersistedTransaction[]
      }

      case 'memory':
        return Array.from(memoryStorage.active.values())

      default:
        return []
    }
  }

  /**
   * Remove transaction
   */
  async remove(id: string): Promise<void> {
    const type = await this.getStorageType()

    switch (type) {
      case 'indexeddb':
        if (!this.db) return
        await this.db.delete(ACTIVE_STORE, id)
        break

      case 'localstorage':
        localStorage.removeItem(`tx-${id}`)
        break

      case 'memory':
        memoryStorage.active.delete(id)
        break
    }
  }

  /**
   * Archive transaction (move to history)
   */
  async archive(transaction: PersistedTransaction): Promise<void> {
    const type = await this.getStorageType()
    const data = { ...transaction, updatedAt: Date.now() }

    switch (type) {
      case 'indexeddb':
        if (!this.db) return
        await this.db.put(HISTORY_STORE, data)
        await this.db.delete(ACTIVE_STORE, transaction.id)
        await this.pruneHistoryIndexedDB()
        break

      case 'localstorage': {
        // Get existing history
        const historyData = localStorage.getItem('tx-history')
        const history: PersistedTransaction[] = historyData
          ? JSON.parse(historyData, (_key, value) =>
              value && typeof value === 'object' && '__bigint' in value
                ? BigInt(value.__bigint)
                : value,
            )
          : []

        // Add new transaction
        history.push(data)

        // Keep only last 100
        const recent = history.slice(-100)
        localStorage.setItem(
          'tx-history',
          JSON.stringify(recent, (_key, value) =>
            typeof value === 'bigint' ? { __bigint: value.toString() } : value,
          ),
        )

        // Remove from active
        localStorage.removeItem(`tx-${transaction.id}`)
        break
      }

      case 'memory':
        memoryStorage.history.set(transaction.id, data)
        memoryStorage.active.delete(transaction.id)

        // Prune memory history
        if (memoryStorage.history.size > MAX_HISTORY_SIZE) {
          const entries = Array.from(memoryStorage.history.entries())
          entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
          const toDelete = entries.slice(0, entries.length - MAX_HISTORY_SIZE)
          toDelete.forEach(([id]) => {
            memoryStorage.history.delete(id)
          })
        }
        break
    }
  }

  /**
   * Prune IndexedDB history
   */
  private async pruneHistoryIndexedDB(): Promise<void> {
    if (!this.db) return

    const tx = this.db.transaction(HISTORY_STORE, 'readwrite')
    const store = tx.objectStore(HISTORY_STORE)
    const index = store.index('timestamp')

    const allEntries = await index.getAll()

    if (allEntries.length > MAX_HISTORY_SIZE) {
      const entriesToDelete = allEntries.length - MAX_HISTORY_SIZE
      const sortedByTimestamp = allEntries.sort(
        (a, b) => a.timestamp - b.timestamp,
      )

      for (let i = 0; i < entriesToDelete; i++) {
        await store.delete(sortedByTimestamp[i].id)
      }
    }

    await tx.done
  }

  /**
   * Get archived transactions (history)
   */
  async getHistory(): Promise<PersistedTransaction[]> {
    const type = await this.getStorageType()

    switch (type) {
      case 'indexeddb': {
        if (!this.db) return []
        const tx = this.db.transaction(HISTORY_STORE, 'readonly')
        const index = tx.objectStore(HISTORY_STORE).index('timestamp')
        const allEntries = await index.getAll()
        return allEntries.sort((a, b) => b.timestamp - a.timestamp)
      }

      case 'localstorage': {
        const data = localStorage.getItem('tx-history')
        return data
          ? JSON.parse(data, (_key, value) =>
              value && typeof value === 'object' && '__bigint' in value
                ? BigInt(value.__bigint)
                : value,
            )
          : []
      }

      case 'memory':
        return Array.from(memoryStorage.history.values()).sort(
          (a, b) => b.timestamp - a.timestamp,
        )

      default:
        return []
    }
  }

  /**
   * Clear all active transactions
   */
  async clearActive(): Promise<void> {
    const type = await this.getStorageType()

    switch (type) {
      case 'indexeddb':
        if (!this.db) return
        await this.db.clear(ACTIVE_STORE)
        break

      case 'localstorage': {
        const keys = Object.keys(localStorage).filter((k) =>
          k.startsWith('tx-'),
        )
        keys.forEach((k) => {
          localStorage.removeItem(k)
        })
        break
      }

      case 'memory':
        memoryStorage.active.clear()
        break
    }
  }

  /**
   * Clear history
   */
  async clearHistory(): Promise<void> {
    const type = await this.getStorageType()

    switch (type) {
      case 'indexeddb':
        if (!this.db) return
        await this.db.clear(HISTORY_STORE)
        break

      case 'localstorage':
        localStorage.removeItem('tx-history')
        break

      case 'memory':
        memoryStorage.history.clear()
        break
    }
  }
}

// Singleton instance
const storage = new StorageManager()

/**
 * Save a transaction
 */
export async function saveTransaction(
  id: string,
  transaction: PersistedTransaction,
): Promise<void> {
  try {
    await storage.save(id, transaction)
  } catch (error) {
    logger.error('Failed to save transaction', error)
    throw error
  }
}

/**
 * Get a transaction
 */
export async function getTransaction(
  id: string,
): Promise<PersistedTransaction | null> {
  try {
    return await storage.get(id)
  } catch (error) {
    logger.error('Failed to get transaction', error)
    return null
  }
}

/**
 * Get all active transactions
 */
export async function getAllTransactions(): Promise<PersistedTransaction[]> {
  try {
    return await storage.getAll()
  } catch (error) {
    logger.error('Failed to get all transactions', error)
    return []
  }
}

/**
 * Get pending transactions (to recover on app load)
 */
export async function getPendingTransactions(): Promise<
  PersistedTransaction[]
> {
  try {
    const all = await storage.getAll()
    return all.filter(
      (tx) =>
        tx.state === 'pending' ||
        tx.state === 'submitting' ||
        tx.state === 'preparing',
    )
  } catch (error) {
    logger.error('Failed to get pending transactions', error)
    return []
  }
}

/**
 * Remove a transaction
 */
export async function removeTransaction(id: string): Promise<void> {
  try {
    await storage.remove(id)
  } catch (error) {
    logger.error('Failed to remove transaction', error)
    throw error
  }
}

/**
 * Clear all active transactions
 */
export async function clearAllTransactions(): Promise<void> {
  try {
    await storage.clearActive()
  } catch (error) {
    logger.error('Failed to clear transactions', error)
    throw error
  }
}

/**
 * Archive a completed transaction
 */
export async function archiveTransaction(
  transaction: PersistedTransaction,
): Promise<void> {
  try {
    await storage.archive(transaction)
  } catch (error) {
    logger.error('Failed to archive transaction', error)
    throw error
  }
}

/**
 * Get archived transactions
 */
export async function getArchivedTransactions(): Promise<
  PersistedTransaction[]
> {
  try {
    return await storage.getHistory()
  } catch (error) {
    logger.error('Failed to get archived transactions', error)
    return []
  }
}

/**
 * Get transaction history (most recent first)
 */
export async function getTransactionHistory(
  limit?: number,
): Promise<PersistedTransaction[]> {
  const archived = await getArchivedTransactions()
  return limit ? archived.slice(0, limit) : archived
}

/**
 * Clear all transaction history
 */
export async function clearTransactionHistory(): Promise<void> {
  try {
    await storage.clearHistory()
  } catch (error) {
    logger.error('Failed to clear history', error)
    throw error
  }
}

/**
 * Get count of transactions in history
 */
export async function getHistoryCount(): Promise<number> {
  try {
    const history = await storage.getHistory()
    return history.length
  } catch (error) {
    logger.error('Failed to get history count', error)
    return 0
  }
}

/**
 * Get count of active transactions
 */
export async function getActiveCount(): Promise<number> {
  try {
    const active = await storage.getAll()
    return active.length
  } catch (error) {
    logger.error('Failed to get active count', error)
    return 0
  }
}

/**
 * Export all data for backup/debugging
 */
export async function exportAllData(): Promise<{
  active: PersistedTransaction[]
  history: PersistedTransaction[]
}> {
  try {
    const [active, history] = await Promise.all([
      storage.getAll(),
      storage.getHistory(),
    ])

    return { active, history }
  } catch (error) {
    logger.error('Failed to export data', error)
    return { active: [], history: [] }
  }
}

/**
 * Get the current storage type being used
 */
export async function getStorageType(): Promise<
  'indexeddb' | 'localstorage' | 'memory'
> {
  return await storage.getStorageType()
}
