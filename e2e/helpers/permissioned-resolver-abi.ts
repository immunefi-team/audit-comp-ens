/**
 * Local override for `subregistryInitializeSnippet`.
 *
 * TODO(ensjs): `@ensdomains/ensjs-abi/v2/verifiableFactory` still declares the
 * two-argument `initialize(address admin, uint256 roleBitmap)`. The deployed
 * `PermissionedResolver` takes a third `setters` argument — a multicall batch
 * run at init time:
 *
 *   function initialize(address admin, uint256 roleBitmap, bytes[] calldata setters)
 *
 * Encoding the old form produces selector `0xcd6dc687`, which the
 * implementation no longer exposes, so the initializer delegatecall from
 * `VerifiableFactory.deployProxy` reverts with empty data.
 *
 * Drop this snippet and re-import from ensjs-abi once it carries the 3-arg form.
 * See contracts-v2 `src/resolver/PermissionedResolver.sol`.
 */
export const subregistryInitializeSnippet = [
  {
    inputs: [
      { name: 'admin', type: 'address' },
      { name: 'roleBitmap', type: 'uint256' },
      { name: 'setters', type: 'bytes[]' },
    ],
    name: 'initialize',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const
