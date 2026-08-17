import { describe, expect, it } from 'vitest'
import { queryClient } from '@/utils/queryClient'

describe('queryClient', () => {
  it('default stale time should be 1 hour', () => {
    expect(queryClient.getDefaultOptions().queries?.staleTime).toBe(
      1000 * 60 * 60 * 1,
    )
  })
})
