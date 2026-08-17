import { parseAbi } from 'viem'

export const VERIFIABLE_FACTORY_ABI = parseAbi([
  'function deployProxy(address implementation, uint256 salt, bytes data)',
  'event ProxyDeployed(address indexed sender, address indexed proxyAddress, uint256 salt, address implementation)',
  'error FailedCall()',
  'error EACInvalidRoleBitmap(uint256)',
])
