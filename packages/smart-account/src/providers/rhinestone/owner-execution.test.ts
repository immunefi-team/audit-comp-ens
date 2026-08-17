import { type Address, decodeFunctionData, type Hex, parseAbi } from 'viem'
import { describe, expect, it } from 'vitest'
import { buildHcaOwnerExecutionCall } from './owner-execution'

const executeByOwnerAbi = parseAbi([
  'function executeByOwner((address target, uint256 value, bytes callData)[] executions) payable',
])

const HCA: Address = '0x1111111111111111111111111111111111111111'
const TARGET_A: Address = '0x2222222222222222222222222222222222222222'
const TARGET_B: Address = '0x3333333333333333333333333333333333333333'
const DATA_A: Hex = '0x1234'
const DATA_B: Hex = '0xabcd'

describe('buildHcaOwnerExecutionCall', () => {
  it('preserves inner call order and maps Call fields to Execution fields', () => {
    const call = buildHcaOwnerExecutionCall({
      hca: HCA,
      calls: [
        { to: TARGET_A, value: 0n, data: DATA_A },
        { to: TARGET_B, value: 42n, data: DATA_B },
      ],
    })

    expect(call.to).toBe(HCA)
    expect(call.value).toBe(0n)

    const decoded = decodeFunctionData({
      abi: executeByOwnerAbi,
      data: call.data,
    })
    expect(decoded.functionName).toBe('executeByOwner')
    expect(decoded.args[0]).toEqual([
      { target: TARGET_A, value: 0n, callData: DATA_A },
      { target: TARGET_B, value: 42n, callData: DATA_B },
    ])
  })

  it('encodes an empty atomic batch without inventing calls', () => {
    const call = buildHcaOwnerExecutionCall({ hca: HCA, calls: [] })
    const decoded = decodeFunctionData({
      abi: executeByOwnerAbi,
      data: call.data,
    })
    expect(decoded.args[0]).toEqual([])
  })
})
