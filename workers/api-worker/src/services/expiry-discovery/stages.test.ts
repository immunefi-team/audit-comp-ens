import { describe, expect, it } from 'vitest'
import { getUpperBoundForStage, STAGES } from './stages.js'

describe('expiry stages', () => {
  it('contains all required stage ids and favorite flags', () => {
    expect(STAGES.map((stage) => stage.id)).toEqual([
      '30d',
      '7d',
      '1d',
      'expired',
    ])

    const byId = new Map(STAGES.map((stage) => [stage.id, stage]))
    expect(byId.get('30d')?.includeFavorites).toBe(false)
    expect(byId.get('7d')?.includeFavorites).toBe(true)
    expect(byId.get('1d')?.includeFavorites).toBe(true)
    expect(byId.get('expired')?.includeFavorites).toBe(true)
  })

  it('computes upper bounds correctly', () => {
    const nowSec = 1_700_000_000
    const byId = new Map(STAGES.map((stage) => [stage.id, stage]))

    // biome-ignore lint/style/noNonNullAssertion: test assertion - stage IDs are known constants
    expect(getUpperBoundForStage(byId.get('expired')!, nowSec)).toBe(nowSec)
    // biome-ignore lint/style/noNonNullAssertion: test assertion - stage IDs are known constants
    expect(getUpperBoundForStage(byId.get('1d')!, nowSec)).toBe(nowSec + 86_400)
    // biome-ignore lint/style/noNonNullAssertion: test assertion - stage IDs are known constants
    expect(getUpperBoundForStage(byId.get('7d')!, nowSec)).toBe(
      nowSec + 7 * 86_400,
    )
    // biome-ignore lint/style/noNonNullAssertion: test assertion - stage IDs are known constants
    expect(getUpperBoundForStage(byId.get('30d')!, nowSec)).toBe(
      nowSec + 30 * 86_400,
    )
  })
})
