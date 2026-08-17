/** biome-ignore-all lint/suspicious/noExplicitAny: Column definitions use internal TanStack Table types that require 'any' assertions for testing */
import { describe, expect, it } from 'vitest'
import { createEventsColumns } from './createEventsColumns'
import type { BaseEvent } from './types'

describe('createEventsColumns', () => {
  it('should return all columns when all options are enabled', () => {
    const columns = createEventsColumns({
      enableNetwork: true,
      enableSidebar: true,
    })

    expect(columns).toHaveLength(6)
    expect(columns.map((col) => col.id || (col as any).accessorKey)).toEqual([
      'expander',
      'timestamp',
      'transactionID',
      'from',
      'network',
      'more',
    ])
  })

  it('should exclude network column when disabled', () => {
    const columns = createEventsColumns({
      enableNetwork: false,
      enableSidebar: true,
    })

    const networkColumn = columns.find(
      (col) => (col as any).accessorKey === 'network',
    )
    expect(networkColumn).toBeUndefined()
    expect(columns).toHaveLength(5)
  })

  it('should exclude sidebar column when disabled', () => {
    const columns = createEventsColumns({
      enableNetwork: true,
      enableSidebar: false,
    })

    const moreColumn = columns.find((col) => col.id === 'more')
    expect(moreColumn).toBeUndefined()
    expect(columns).toHaveLength(5)
  })

  it('should only include base columns when all options are disabled', () => {
    const columns = createEventsColumns({
      enableNetwork: false,
      enableSidebar: false,
    })

    expect(columns).toHaveLength(4)
    expect(columns.map((col) => col.id || (col as any).accessorKey)).toEqual([
      'expander',
      'timestamp',
      'transactionID',
      'from',
    ])
  })

  it('should maintain correct column order', () => {
    const columns = createEventsColumns()

    const columnIds = columns.map((col) => col.id || (col as any).accessorKey)

    // Core columns should always be in this order
    expect(columnIds[0]).toBe('expander')
    expect(columnIds[1]).toBe('timestamp')
    expect(columnIds[2]).toBe('transactionID')
    expect(columnIds[3]).toBe('from')
    // Network and more columns are conditional
  })

  it('should support custom network defaults', () => {
    const customConfig = {
      defaultNetworkName: 'Custom Network',
      defaultNetworkIcon: '/custom.svg',
      enableNetwork: true,
    }

    const columns = createEventsColumns(customConfig)

    // Verify columns are created with custom config
    expect(columns.length).toBeGreaterThan(0)
    const networkColumn = columns.find(
      (col) => (col as any).accessorKey === 'network',
    )
    expect(networkColumn).toBeDefined()
  })

  it('should support generic event types', () => {
    interface CustomEvent extends BaseEvent {
      customField: string
    }

    const columns = createEventsColumns<CustomEvent>()

    expect(columns).toBeDefined()
    expect(columns.length).toBeGreaterThan(0)
  })
})
