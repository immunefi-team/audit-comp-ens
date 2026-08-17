/** Direct owner execution builders for the standalone HCA. */

import { type Address, encodeFunctionData, parseAbi } from 'viem'
import type { Call } from './registration-calls'

const standaloneHcaOwnerExecutionAbi = parseAbi([
  'function executeByOwner((address target, uint256 value, bytes callData)[] executions) payable',
])

export interface BuildHcaOwnerExecutionCallParams {
  readonly hca: Address
  readonly calls: readonly Call[]
}

/**
 * Wrap arbitrary calls in one owner-authorized, atomic HCA execution.
 *
 * The outer call intentionally carries zero value. Inner values are paid from
 * the HCA balance; callers that need to fund the account should do so before
 * submitting this call.
 */
export function buildHcaOwnerExecutionCall(
  params: BuildHcaOwnerExecutionCallParams,
): Call {
  const executions = params.calls.map((call) => ({
    target: call.to,
    value: call.value,
    callData: call.data,
  }))

  return {
    to: params.hca,
    value: 0n,
    data: encodeFunctionData({
      abi: standaloneHcaOwnerExecutionAbi,
      functionName: 'executeByOwner',
      args: [executions],
    }),
  }
}
