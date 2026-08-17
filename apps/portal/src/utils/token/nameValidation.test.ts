import { describe, expect, it } from 'vitest'
import {
  validateNameLength,
  validateRegistrableEthName,
} from './nameValidation'

describe('validateRegistrableEthName', () => {
  it('returns undefined for valid .eth 2LD names', () => {
    expect(validateRegistrableEthName('vitalik.eth')).toBeUndefined()
    expect(validateRegistrableEthName('hello.eth')).toBeUndefined()
    expect(validateRegistrableEthName('abc.eth')).toBeUndefined()
  })

  it('returns error for names without .eth TLD', () => {
    expect(validateRegistrableEthName('vitalik')).toBe(
      'Only .eth names can be registered (e.g. name.eth).',
    )
    expect(validateRegistrableEthName('vitalik.xyz')).toBe(
      'Only .eth names can be registered (e.g. name.eth).',
    )
  })

  it('returns error for subnames (3LD+)', () => {
    expect(validateRegistrableEthName('sub.vitalik.eth')).toBe(
      'Only .eth names can be registered (e.g. name.eth).',
    )
  })

  it('returns error for non-normalized names', () => {
    expect(validateRegistrableEthName('Vitalik.eth')).toBe(
      'Label contains invalid or non-normalized characters.',
    )
  })

  it('returns error for empty or whitespace', () => {
    expect(validateRegistrableEthName('')).toBe('Enter a name to register.')
    expect(validateRegistrableEthName('   ')).toBe('Enter a name to register.')
  })
})

describe('validateNameLength', () => {
  it('returns error for 1–2 character names', () => {
    expect(validateNameLength('a')).toBe(
      'Names must be 3 characters or more to register.',
    )
    expect(validateNameLength('ab')).toBe(
      'Names must be 3 characters or more to register.',
    )
    expect(validateNameLength('a.eth')).toBe(
      'Names must be 3 characters or more to register.',
    )
    expect(validateNameLength('ab.eth')).toBe(
      'Names must be 3 characters or more to register.',
    )
  })

  it('returns null for valid 3+ character names', () => {
    expect(validateNameLength('abc')).toBeNull()
    expect(validateNameLength('abcd')).toBeNull()
    expect(validateNameLength('cet.eth')).toBeNull()
    expect(validateNameLength('hello.eth')).toBeNull()
  })

  it('returns error for invalid names (empty, unparseable)', () => {
    expect(validateNameLength('')).toBe('Invalid name')
  })
})

describe('validateRegistrableEthName — encoded labelhash labels', () => {
  it('rejects bracket-form labels with a specific message (not "too short")', () => {
    expect(
      validateRegistrableEthName(
        '[023e0d05ab821f1deb4821991c1a5bb8e1d9d71b7113d61cce6972934f939773].eth',
      ),
    ).toMatch(/cannot be registered/)
  })
})
