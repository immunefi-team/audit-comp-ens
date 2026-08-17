import { describe, expect, it } from 'vitest'
import { cn, fromCoinType } from './utils'

describe('cn', () => {
  it('should merge class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('should handle conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
    expect(cn('foo', true && 'bar')).toBe('foo bar')
  })

  it('should resolve Tailwind conflicts (tailwind-merge)', () => {
    // Later class should win
    expect(cn('px-2', 'px-4')).toBe('px-4')
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500')
  })

  // Regression (WEB-649): the default tailwind-merge classified our custom
  // type classes as text COLORS and dropped them next to a real color class,
  // which stripped the entity typography off EntityBadge.
  it('keeps custom type classes alongside text colors', () => {
    expect(cn('text-entity-name', 'text-accent-text')).toBe(
      'text-entity-name text-accent-text',
    )
    expect(cn('text-ui', 'text-default-text')).toBe('text-ui text-default-text')
  })

  it('merges conflicting type-scale classes (last wins)', () => {
    expect(cn('text-entity-base', 'text-entity-name')).toBe('text-entity-name')
    expect(cn('text-sm', 'text-entity-base')).toBe('text-entity-base')
  })

  it('should handle empty inputs', () => {
    expect(cn()).toBe('')
    expect(cn('')).toBe('')
  })

  it('should handle arrays', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar')
  })

  it('should handle objects', () => {
    expect(cn({ foo: true, bar: false })).toBe('foo')
  })

  it('should combine multiple input types', () => {
    expect(
      cn('base', { active: true, disabled: false }, ['extra', 'classes']),
    ).toBe('base active extra classes')
  })

  it('should handle complex Tailwind merging scenarios', () => {
    // Responsive classes
    expect(cn('p-2 md:p-4', 'p-6')).toBe('md:p-4 p-6')

    // Hover states
    expect(cn('hover:bg-red-500', 'hover:bg-blue-500')).toBe(
      'hover:bg-blue-500',
    )
  })
})

describe('fromCoinType', () => {
  it('should handle Ethereum mainnet special case (coinType 60 -> chainId 1)', () => {
    expect(fromCoinType(60n)).toBe(1)
  })

  it('should handle raw chain IDs used as coin types (L2 pattern)', () => {
    expect(fromCoinType(10n)).toBe(10) // Optimism
    expect(fromCoinType(42161n)).toBe(42161) // Arbitrum One
    expect(fromCoinType(8453n)).toBe(8453) // Base
    expect(fromCoinType(59144n)).toBe(59144) // Linea
    expect(fromCoinType(534352n)).toBe(534352) // Scroll
  })
})
