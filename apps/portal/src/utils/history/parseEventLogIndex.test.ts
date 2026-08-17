import { describe, expect, it } from 'vitest'
import { parseEventLogIndex } from './parseEventLogIndex'

describe('parseEventLogIndex', () => {
  it('should parse log index from standard event ID', () => {
    const result = parseEventLogIndex('0xabc123-5')

    expect(result).toBe(5)
  })

  it('should parse zero index', () => {
    const result = parseEventLogIndex('0xabc-0')

    expect(result).toBe(0)
  })

  it('should return NaN for invalid event ID format', () => {
    const result = parseEventLogIndex('invalid')

    expect(result).toBeNaN()
  })

  it('should return NaN for null event ID', () => {
    const result = parseEventLogIndex(null)

    expect(result).toBeNaN()
  })

  it('should return NaN for undefined event ID', () => {
    const result = parseEventLogIndex(undefined)

    expect(result).toBeNaN()
  })

  it('should return NaN for empty string', () => {
    const result = parseEventLogIndex('')

    expect(result).toBeNaN()
  })
})
