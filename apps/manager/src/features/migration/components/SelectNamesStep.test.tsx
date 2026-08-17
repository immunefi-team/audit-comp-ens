import { fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { MigrationGasEstimateState } from '@/features/migration/hooks/useMigrationGasEstimate'
import type { MigrationGasFundingStatus } from '@/features/migration/hooks/useMigrationGasFunding'
import type { MigrationPlan } from '@/features/migration/service/buildMigrationPlan'
import { render } from '@/utils/test-utils'
import type { ClassifiedName } from '../service/classifyNames'

const makeName = (
  fullName: string,
  tokenType: ClassifiedName['tokenType'],
): ClassifiedName => {
  const label = fullName.split('.')[0] ?? fullName
  const parentName = fullName.includes('.')
    ? fullName.split('.').slice(1).join('.')
    : null
  return {
    domain: {
      id: fullName,
      name: fullName,
      labelName: label,
    },
    tokenType,
    label,
    parentName,
    fuses: 0,
    tokenHolder: '0x0000000000000000000000000000000000000001',
    v1ResolverAddress: null,
    resolverStrategy: 'to-owned-permres',
    managerAddress: null,
  } as unknown as ClassifiedName
}

const eligibleFixture: readonly ClassifiedName[] = [
  makeName('sub1234.eth', 'unwrapped'),
  makeName('gm.sub1234.eth', 'locked-child'),
  makeName('sub123.eth', 'unwrapped'),
  makeName('one.eth', 'unwrapped'),
  makeName('two.eth', 'unwrapped'),
  makeName('three.eth', 'unwrapped'),
  makeName('four.eth', 'unwrapped'),
  makeName('five.eth', 'unwrapped'),
  makeName('six.eth', 'unwrapped'),
]

vi.mock('@/features/migration/hooks/useEligibleV1Names', () => ({
  useEligibleV1Names: () => ({ eligible: eligibleFixture, isPending: false }),
}))

// eslint-disable-next-line import/first
import { SelectNamesStep } from './SelectNamesStep'

const readyGasEstimate: MigrationGasEstimateState = {
  status: 'ready',
  plan: { stepDescriptors: [] } as unknown as MigrationPlan,
  formattedEth: '0.001',
  gasUnits: 1n,
  feeWei: 1n,
  transactionCount: 1,
}

const renderStep = ({
  gasEstimate = { status: 'idle' } as MigrationGasEstimateState,
  gasFundingStatus = 'settled',
  onNext = vi.fn(),
}: {
  gasEstimate?: MigrationGasEstimateState
  gasFundingStatus?: MigrationGasFundingStatus
  onNext?: () => boolean | Promise<boolean>
} = {}) => {
  const onNamesChange = vi.fn<(names: string[]) => void>()
  const utils = render(
    <SelectNamesStep
      gasEstimate={gasEstimate}
      gasFundingStatus={gasFundingStatus}
      onNamesChange={onNamesChange}
      onNext={onNext}
    />,
  )
  return { onNamesChange, onNext, ...utils }
}

describe('SelectNamesStep', () => {
  it('seeds all visible names (parent + subnames + orphans) as selected', () => {
    const { onNamesChange, getByText } = renderStep()
    expect(getByText('sub1234.eth')).toBeInTheDocument()
    expect(getByText('gm.sub1234.eth')).toBeInTheDocument()
    expect(getByText('sub123.eth')).toBeInTheDocument()
    const lastCall = onNamesChange.mock.calls.at(-1)?.[0] ?? []
    expect([...lastCall].sort()).toEqual(
      eligibleFixture.map((item) => item.domain.name).sort(),
    )
  })

  it('unselecting a parent unselects all its subnames', () => {
    const { onNamesChange, getByText } = renderStep()
    const parentRow = getByText('sub1234.eth').closest('button')
    if (!parentRow) throw new Error('parent row not found')
    fireEvent.click(parentRow)
    const lastCall = onNamesChange.mock.calls.at(-1)?.[0] ?? []
    expect(lastCall).not.toContain('sub1234.eth')
    expect(lastCall).not.toContain('gm.sub1234.eth')
    expect(lastCall).toContain('sub123.eth')
  })

  it('re-selecting a parent re-adds all its subnames', () => {
    const { onNamesChange, getByText } = renderStep()
    const parentRow = getByText('sub1234.eth').closest('button')
    if (!parentRow) throw new Error('parent row not found')
    fireEvent.click(parentRow)
    fireEvent.click(parentRow)
    const lastCall = onNamesChange.mock.calls.at(-1)?.[0] ?? []
    expect(lastCall).toContain('sub1234.eth')
    expect(lastCall).toContain('gm.sub1234.eth')
  })

  it('subname rows are not individually interactive', () => {
    const { onNamesChange, getByText } = renderStep()
    const subnameText = getByText('gm.sub1234.eth')
    expect(subnameText.closest('button')).toBeNull()
    const callsBefore = onNamesChange.mock.calls.length
    fireEvent.click(subnameText)
    expect(onNamesChange.mock.calls.length).toBe(callsBefore)
  })

  it('searching a subname keeps the parent visible for context', () => {
    const { getByLabelText, getByText, queryByText } = renderStep()
    const searchInput = getByLabelText('Search names')
    fireEvent.change(searchInput, { target: { value: 'gm' } })
    expect(getByText('gm.sub1234.eth')).toBeInTheDocument()
    expect(getByText('sub1234.eth')).toBeInTheDocument()
    expect(queryByText('sub123.eth')).toBeNull()
  })

  it('blocks upgrade while gas funding is still in flight', () => {
    const onNext = vi.fn(async () => true)
    const { getByRole } = renderStep({
      gasEstimate: readyGasEstimate,
      gasFundingStatus: 'funding',
      onNext,
    })

    const button = getByRole('button', { name: 'Preparing wallet...' })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(onNext).not.toHaveBeenCalled()
  })

  it('enables upgrade once gas funding has settled', () => {
    const { getByRole } = renderStep({
      gasEstimate: readyGasEstimate,
      gasFundingStatus: 'settled',
    })
    expect(getByRole('button', { name: 'Upgrade 9 names' })).not.toBeDisabled()
  })

  it('allows retrying when upgrade start exits without transitioning', async () => {
    const onNext = vi.fn(async () => false)
    const { getByRole } = renderStep({
      gasEstimate: readyGasEstimate,
      onNext,
    })

    const button = getByRole('button', { name: 'Upgrade 9 names' })
    fireEvent.click(button)

    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1))
    await waitFor(() => {
      expect(
        getByRole('button', { name: 'Upgrade 9 names' }),
      ).not.toBeDisabled()
    })
  })
})
