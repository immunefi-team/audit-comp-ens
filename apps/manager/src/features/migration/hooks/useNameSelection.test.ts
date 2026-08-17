import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ClassifiedName } from '../service/classifyNames'
import { useNameSelection } from './useNameSelection'

const makeName = (name: string): ClassifiedName =>
  ({
    domain: {
      id: name,
      name,
      labelName: name.split('.')[0] ?? name,
    },
    parentName: null,
  }) as ClassifiedName

describe('useNameSelection', () => {
  it('prunes selected names when eligibility changes', async () => {
    const onNamesChange = vi.fn<(names: string[]) => void>()
    const first = [makeName('one.eth'), makeName('two.eth')]
    const next = [makeName('one.eth')]

    const { result, rerender } = renderHook(
      ({ eligible }) =>
        useNameSelection({
          eligible,
          isPending: false,
          onNamesChange,
        }),
      { initialProps: { eligible: first } },
    )

    await waitFor(() => expect(result.current.totalSelected).toBe(2))

    rerender({ eligible: next })

    await waitFor(() => expect(result.current.totalSelected).toBe(1))
    expect(result.current.selected.has('two.eth')).toBe(false)
    expect(onNamesChange.mock.calls.at(-1)?.[0]).toEqual(['one.eth'])
  })
})
