export const RESOLVER_INTERFACE_IDS = {
  AddressResolver: '0x3b3b57de',
  NameResolver: '0x691f3431',
  AbiResolver: '0x2203ab56',
  TextResolver: '0x59d1d43c',
  ContentHashResolver: '0xbc1c58d1',
  DnsRecordResolver: '0xa8fa5682',
  InterfaceResolver: '0x124a319c',
  ExtendedResolver: '0x9061b923',
  VersionableResolver: '0xd700ff33',
  // XOR of initialize/setAlias/getAlias — verified against the deployed
  // implementation via supportsInterface. The old `DedicatedResolver`
  // (0x92349baa) pointed at namechain, which no longer exists; the deployed
  // resolver returns false for it.
  PermissionedResolver: '0x91413117',
  CompositeExtendedResolver: '0xc7e45d73',
} as const
export type ResolverInterfaceName = keyof typeof RESOLVER_INTERFACE_IDS

// @ts-expect-error not all features are displayed yet
export const RESOLVER_FEATURES: Record<
  ResolverInterfaceName,
  { name: string; link: string }
> = {
  ContentHashResolver: {
    name: 'Content hash resolution',
    link: 'https://github.com/ensdomains/ens-contracts/blob/be53b9c25be5b2c7326f524bbd34a3939374ab1f/contracts/resolvers/profiles/IContentHashResolver.sol',
  },
  AddressResolver: {
    name: 'Address resolver',
    link: 'https://github.com/ensdomains/ens-contracts/blob/be53b9c25be5b2c7326f524bbd34a3939374ab1f/contracts/resolvers/profiles/IAddressResolver.sol',
  },
  InterfaceResolver: {
    name: 'Interface detection',
    link: 'https://github.com/ensdomains/ens-contracts/blob/be53b9c25be5b2c7326f524bbd34a3939374ab1f/contracts/resolvers/profiles/InterfaceResolver.sol',
  },
  AbiResolver: {
    name: 'ABI resolution for contracts',
    link: 'https://github.com/ensdomains/ens-contracts/blob/be53b9c25be5b2c7326f524bbd34a3939374ab1f/contracts/resolvers/profiles/ABIResolver.sol',
  },
  TextResolver: {
    name: 'Text records',
    link: 'https://github.com/ensdomains/ens-contracts/blob/be53b9c25be5b2c7326f524bbd34a3939374ab1f/contracts/resolvers/profiles/TextResolver.sol',
  },
  PermissionedResolver: {
    name: 'Permissioned resolver',
    link: 'https://github.com/ensdomains/contracts-v2/blob/main/contracts/src/resolver/PermissionedResolver.sol',
  },
  CompositeExtendedResolver: {
    name: 'Composite',
    link: 'https://github.com/ensdomains/ens-contracts/blob/be53b9c25be5b2c7326f524bbd34a3939374ab1f/contracts/resolvers/profiles/ICompositeResolver.sol#L8',
  },
} as const
