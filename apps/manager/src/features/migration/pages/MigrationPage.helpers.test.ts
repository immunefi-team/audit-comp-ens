import { describe, expect, it } from 'vitest'
import { isMigrationQueryKey } from './MigrationPage.helpers'

describe('isMigrationQueryKey', () => {
  it.each([
    ['legacy preflight key', ['migration-preflight', { x: 1 }], true],
    [
      'qk-scoped migration key',
      [{ $scope: 'migration', kind: 'foo' }, { x: 1 }],
      true,
    ],
    ['qk-scoped non-migration key', [{ $scope: 'dashboard' }, { x: 1 }], false],
    ['unrelated key', ['dashboard-domains'], false],
    ['empty key', [], false],
  ] as const)('%s → %s', (_, key, expected) => {
    expect(isMigrationQueryKey([...key])).toBe(expected)
  })
})
