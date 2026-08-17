import { nameWrapperGetDataSnippet } from '@ensdomains/ensjs-abi/v1/nameWrapper'
import { erc721Abi, erc1155Abi, parseAbi } from 'viem'

export const BASE_REGISTRAR_ABI = erc721Abi

// TODO(ensjs): upstream `getApproved(uint256) view returns (address)` on NameWrapper
// to @ensdomains/ensjs-abi/v1/nameWrapper and drop this local snippet.
const nameWrapperGetApprovedSnippet = parseAbi([
  'function getApproved(uint256 id) view returns (address)',
])

export const NAME_WRAPPER_ABI = [
  ...erc1155Abi,
  ...nameWrapperGetDataSnippet,
  ...nameWrapperGetApprovedSnippet,
] as const
