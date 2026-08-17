import { describe, expect, it } from 'vitest'
import { parseLabelsAndParent } from './parseLabelsAndParent'

describe('parseLabelsAndParent', () => {
  it('should parse a standard second-level domain', () => {
    const result = parseLabelsAndParent('vitalik.eth')

    expect(result).toEqual({
      labels: ['vitalik'],
      parent: 'eth',
    })
  })

  it('should parse a subdomain', () => {
    const result = parseLabelsAndParent('sub.vitalik.eth')

    expect(result).toEqual({
      labels: ['sub', 'vitalik'],
      parent: 'eth',
    })
  })

  it('should parse a TLD-only name', () => {
    const result = parseLabelsAndParent('eth')

    expect(result).toEqual({
      labels: [],
      parent: 'eth',
    })
  })

  it('should handle empty string', () => {
    const result = parseLabelsAndParent('')

    expect(result).toEqual({
      labels: [],
      parent: '',
    })
  })
})
