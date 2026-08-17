import gql from 'graphql-tag';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

export type Account = {
  __typename?: 'Account';
  domains: Array<Domain>;
  firstSeenBlock: Scalars['Int']['output'];
  firstSeenTimestamp: Scalars['Int']['output'];
  id: Scalars['String']['output'];
  primaryName?: Maybe<Scalars['String']['output']>;
  primaryNameVerification?: Maybe<PrimaryNameVerification>;
  registrations: Array<Registration>;
  seenV1: Scalars['Boolean']['output'];
  seenV2: Scalars['Boolean']['output'];
  wrappedDomains: Array<WrappedDomain>;
};


export type AccountRegistrationsArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
};


export type AccountWrappedDomainsArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
};

export type AccountFilter = {
  id?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<Scalars['String']['input']>>;
  seenV1?: InputMaybe<Scalars['Boolean']['input']>;
  seenV2?: InputMaybe<Scalars['Boolean']['input']>;
};

export enum Account_OrderBy {
  FirstSeenBlock = 'firstSeenBlock',
  Id = 'id'
}

export type AddressChangedData = {
  __typename?: 'AddressChangedData';
  address?: Maybe<Scalars['String']['output']>;
  coinType?: Maybe<Scalars['Int']['output']>;
  namehash?: Maybe<Scalars['String']['output']>;
  resolver?: Maybe<Scalars['String']['output']>;
};

export type Alias = {
  __typename?: 'Alias';
  fromName: Scalars['String']['output'];
  toName: Scalars['String']['output'];
};

export type CoinAddress = {
  __typename?: 'CoinAddress';
  address: Scalars['String']['output'];
  coinType: Scalars['Int']['output'];
  coinTypeBig: Scalars['String']['output'];
};

export type Coverage = {
  __typename?: 'Coverage';
  chainId: Scalars['Int']['output'];
  protocols: Array<ProtocolCoverage>;
  stale: Scalars['Boolean']['output'];
};

export type Domain = {
  __typename?: 'Domain';
  canonicalId?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['Int']['output'];
  events: Array<Event>;
  eventsCount: Scalars['Int']['output'];
  expiryDate?: Maybe<Scalars['Int']['output']>;
  finality?: Maybe<DomainFinality>;
  fuses?: Maybe<Scalars['Int']['output']>;
  gracePeriodEnd?: Maybe<Scalars['Int']['output']>;
  id: Scalars['String']['output'];
  isLegacy: Scalars['Boolean']['output'];
  isMigrated: Scalars['Boolean']['output'];
  isNormalized: Scalars['Boolean']['output'];
  isReachable: Scalars['Boolean']['output'];
  isWrapped: Scalars['Boolean']['output'];
  labelName?: Maybe<Scalars['String']['output']>;
  labelhash: Scalars['String']['output'];
  name?: Maybe<Scalars['String']['output']>;
  normalizedName?: Maybe<Scalars['String']['output']>;
  owner: Account;
  parent?: Maybe<Domain>;
  protocol: Scalars['String']['output'];
  registrant?: Maybe<Account>;
  registrationDate?: Maybe<Scalars['Int']['output']>;
  resolvedAddress?: Maybe<Account>;
  resolver?: Maybe<Resolver>;
  roleHolderCount: Scalars['Int']['output'];
  subdomainCount: Scalars['Int']['output'];
  subdomains: Array<Domain>;
  subdomainsCount: Scalars['Int']['output'];
  subregistry?: Maybe<RegistryInfo>;
  tokenId?: Maybe<Scalars['String']['output']>;
  tokenVersion?: Maybe<Scalars['Int']['output']>;
  ttl?: Maybe<Scalars['Int']['output']>;
  unreachableSince?: Maybe<Scalars['Int']['output']>;
  wrappedDomain?: Maybe<WrappedDomain>;
  wrappedOwner?: Maybe<Account>;
  wrapperExpiry?: Maybe<Scalars['Int']['output']>;
};


export type DomainEventsArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<EventFilter>;
};

export type DomainConnection = {
  __typename?: 'DomainConnection';
  edges: Array<DomainEdge>;
  pageInfo: PageInfo;
  totalCount?: Maybe<Scalars['Int']['output']>;
};

export type DomainEdge = {
  __typename?: 'DomainEdge';
  cursor: Scalars['String']['output'];
  node: Domain;
};

export type DomainFilter = {
  and?: InputMaybe<Array<DomainFilter>>;
  expiryDate_gt?: InputMaybe<Scalars['Int']['input']>;
  expiryDate_gte?: InputMaybe<Scalars['Int']['input']>;
  expiryDate_lt?: InputMaybe<Scalars['Int']['input']>;
  expiryDate_lte?: InputMaybe<Scalars['Int']['input']>;
  expiry_gt?: InputMaybe<Scalars['Int']['input']>;
  expiry_gte?: InputMaybe<Scalars['Int']['input']>;
  expiry_lt?: InputMaybe<Scalars['Int']['input']>;
  expiry_lte?: InputMaybe<Scalars['Int']['input']>;
  hasSubdomains?: InputMaybe<Scalars['Boolean']['input']>;
  includeUnnormalized?: InputMaybe<Scalars['Boolean']['input']>;
  includeUnreachable?: InputMaybe<Scalars['Boolean']['input']>;
  isMigrated?: InputMaybe<Scalars['Boolean']['input']>;
  isNormalized?: InputMaybe<Scalars['Boolean']['input']>;
  labelName?: InputMaybe<Scalars['String']['input']>;
  labelName_contains?: InputMaybe<Scalars['String']['input']>;
  labelName_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  labelName_ends_with?: InputMaybe<Scalars['String']['input']>;
  labelName_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  labelName_in?: InputMaybe<Array<Scalars['String']['input']>>;
  labelName_not?: InputMaybe<Scalars['String']['input']>;
  labelName_not_contains?: InputMaybe<Scalars['String']['input']>;
  labelName_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  labelName_starts_with?: InputMaybe<Scalars['String']['input']>;
  labelName_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  name_contains?: InputMaybe<Scalars['String']['input']>;
  name_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  name_ends_with?: InputMaybe<Scalars['String']['input']>;
  name_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  name_in?: InputMaybe<Array<Scalars['String']['input']>>;
  name_not?: InputMaybe<Scalars['String']['input']>;
  name_not_contains?: InputMaybe<Scalars['String']['input']>;
  name_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  name_starts_with?: InputMaybe<Scalars['String']['input']>;
  name_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  or?: InputMaybe<Array<DomainFilter>>;
  owner?: InputMaybe<Scalars['String']['input']>;
  owner_?: InputMaybe<AccountFilter>;
  owner_in?: InputMaybe<Array<Scalars['String']['input']>>;
  owner_not?: InputMaybe<Scalars['String']['input']>;
  owner_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  resolvedAddress?: InputMaybe<Scalars['String']['input']>;
  resolver?: InputMaybe<Scalars['String']['input']>;
  subdomainCount_gt?: InputMaybe<Scalars['Int']['input']>;
  subdomainCount_lt?: InputMaybe<Scalars['Int']['input']>;
};

export enum DomainFinality {
  Finalized = 'FINALIZED',
  Head = 'HEAD',
  Safe = 'SAFE'
}

export enum Domain_OrderBy {
  CreatedAt = 'createdAt',
  ExpiryDate = 'expiryDate',
  Id = 'id',
  Name = 'name',
  RegistrationDate = 'registrationDate'
}

export type EacRoleAssignment = {
  __typename?: 'EACRoleAssignment';
  account: Scalars['String']['output'];
  blockNumber: Scalars['Int']['output'];
  id: Scalars['String']['output'];
  name?: Maybe<Scalars['String']['output']>;
  permissions: Array<Scalars['String']['output']>;
  resource: Scalars['String']['output'];
  roleBitmap: Scalars['String']['output'];
  timestamp: Scalars['Int']['output'];
  transactionHash: Scalars['String']['output'];
};

export type EacRoleAssignmentConnection = {
  __typename?: 'EACRoleAssignmentConnection';
  edges: Array<EacRoleAssignmentEdge>;
  pageInfo: PageInfo;
  totalCount?: Maybe<Scalars['Int']['output']>;
};

export type EacRoleAssignmentEdge = {
  __typename?: 'EACRoleAssignmentEdge';
  cursor: Scalars['String']['output'];
  node: EacRoleAssignment;
};

export type Event = {
  __typename?: 'Event';
  asAddressChanged?: Maybe<AddressChangedData>;
  asExpiryUpdated?: Maybe<ExpiryUpdatedData>;
  asFusesSet?: Maybe<FusesSetData>;
  asLabelRegistered?: Maybe<LabelRegisteredData>;
  asNameRegistered?: Maybe<NameRegisteredData>;
  asNameRenewed?: Maybe<NameRenewedData>;
  asNameUnwrapped?: Maybe<NameUnwrappedData>;
  asNameWrapped?: Maybe<NameWrappedData>;
  asRegistryTransfer?: Maybe<RegistryTransferData>;
  asResolverUpdated?: Maybe<ResolverUpdatedData>;
  asReverseClaimed?: Maybe<ReverseClaimedData>;
  asTextChanged?: Maybe<TextChangedData>;
  asTransfer?: Maybe<TransferData>;
  blockNumber: Scalars['Int']['output'];
  contractAddress: Scalars['String']['output'];
  data?: Maybe<Scalars['String']['output']>;
  domain?: Maybe<Domain>;
  id: Scalars['String']['output'];
  key?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  namehash?: Maybe<Scalars['String']['output']>;
  protocol: Scalars['String']['output'];
  timestamp: Scalars['Int']['output'];
  transactionHash: Scalars['String']['output'];
  type: Scalars['String']['output'];
  value?: Maybe<Scalars['String']['output']>;
};

export type EventConnection = {
  __typename?: 'EventConnection';
  edges: Array<EventEdge>;
  pageInfo: PageInfo;
  totalCount?: Maybe<Scalars['Int']['output']>;
};

export type EventEdge = {
  __typename?: 'EventEdge';
  cursor: Scalars['String']['output'];
  node: Event;
};

export type EventFilter = {
  and?: InputMaybe<Array<EventFilter>>;
  blockNumber_gt?: InputMaybe<Scalars['Int']['input']>;
  blockNumber_gte?: InputMaybe<Scalars['Int']['input']>;
  blockNumber_lt?: InputMaybe<Scalars['Int']['input']>;
  blockNumber_lte?: InputMaybe<Scalars['Int']['input']>;
  contractAddress?: InputMaybe<Scalars['String']['input']>;
  domain?: InputMaybe<Scalars['String']['input']>;
  involved?: InputMaybe<Scalars['String']['input']>;
  namehash?: InputMaybe<Scalars['String']['input']>;
  or?: InputMaybe<Array<EventFilter>>;
  protocol?: InputMaybe<Scalars['String']['input']>;
  timestamp_gt?: InputMaybe<Scalars['Int']['input']>;
  timestamp_gte?: InputMaybe<Scalars['Int']['input']>;
  timestamp_lt?: InputMaybe<Scalars['Int']['input']>;
  timestamp_lte?: InputMaybe<Scalars['Int']['input']>;
  type?: InputMaybe<Scalars['String']['input']>;
  type_in?: InputMaybe<Array<Scalars['String']['input']>>;
  type_not?: InputMaybe<Scalars['String']['input']>;
  type_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
};

export enum Event_OrderBy {
  BlockNumber = 'blockNumber',
  Name = 'name',
  Timestamp = 'timestamp'
}

export type ExpiryUpdatedData = {
  __typename?: 'ExpiryUpdatedData';
  expiry?: Maybe<Scalars['Int']['output']>;
  node?: Maybe<Scalars['String']['output']>;
  tokenId?: Maybe<Scalars['String']['output']>;
};

export type Finality = {
  __typename?: 'Finality';
  finalized?: Maybe<FinalityBlock>;
  head: FinalityBlock;
  isStale: Scalars['Boolean']['output'];
  safe?: Maybe<FinalityBlock>;
};

export type FinalityBlock = {
  __typename?: 'FinalityBlock';
  hash?: Maybe<Scalars['String']['output']>;
  number: Scalars['Int']['output'];
  updatedAt?: Maybe<Scalars['Int']['output']>;
};

export type FusesSetData = {
  __typename?: 'FusesSetData';
  fuses?: Maybe<Scalars['Int']['output']>;
  node?: Maybe<Scalars['String']['output']>;
};

export type InterfaceRecord = {
  __typename?: 'InterfaceRecord';
  implementer: Scalars['String']['output'];
  interfaceId: Scalars['String']['output'];
};

export type LabelRegisteredData = {
  __typename?: 'LabelRegisteredData';
  canonicalId?: Maybe<Scalars['String']['output']>;
  expiry?: Maybe<Scalars['Int']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  owner?: Maybe<Scalars['String']['output']>;
  registry?: Maybe<Scalars['String']['output']>;
  sender?: Maybe<Scalars['String']['output']>;
  tokenId?: Maybe<Scalars['String']['output']>;
};

export type NameRegisteredData = {
  __typename?: 'NameRegisteredData';
  baseCost?: Maybe<Scalars['String']['output']>;
  cost?: Maybe<Scalars['String']['output']>;
  expires?: Maybe<Scalars['Int']['output']>;
  label?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  owner?: Maybe<Scalars['String']['output']>;
  premium?: Maybe<Scalars['String']['output']>;
  referrer?: Maybe<Scalars['String']['output']>;
};

export type NameRenewedData = {
  __typename?: 'NameRenewedData';
  expires?: Maybe<Scalars['Int']['output']>;
  id?: Maybe<Scalars['String']['output']>;
};

export type NameUnwrappedData = {
  __typename?: 'NameUnwrappedData';
  node?: Maybe<Scalars['String']['output']>;
  owner?: Maybe<Scalars['String']['output']>;
};

export type NameWrappedData = {
  __typename?: 'NameWrappedData';
  expiry?: Maybe<Scalars['Int']['output']>;
  fuses?: Maybe<Scalars['Int']['output']>;
  node?: Maybe<Scalars['String']['output']>;
  owner?: Maybe<Scalars['String']['output']>;
};

export type NamedResourceEntry = {
  __typename?: 'NamedResourceEntry';
  blockNumber: Scalars['Int']['output'];
  coinType: Scalars['String']['output'];
  name: Scalars['String']['output'];
  protocol: Scalars['String']['output'];
  recordKey: Scalars['String']['output'];
  recordKind: Scalars['String']['output'];
  resource: Scalars['String']['output'];
};

export enum OrderDirection {
  Asc = 'asc',
  Desc = 'desc'
}

export type PageInfo = {
  __typename?: 'PageInfo';
  endCursor?: Maybe<Scalars['String']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  startCursor?: Maybe<Scalars['String']['output']>;
};

export enum PrimaryNameVerification {
  InvalidName = 'INVALID_NAME',
  Mismatch = 'MISMATCH',
  NotFound = 'NOT_FOUND',
  Unverified = 'UNVERIFIED',
  Verified = 'VERIFIED'
}

export type ProtocolCoverage = {
  __typename?: 'ProtocolCoverage';
  indexedHead: Scalars['Int']['output'];
  lastSyncedAt?: Maybe<Scalars['Int']['output']>;
  protocol: Scalars['String']['output'];
};

export type Pubkey = {
  __typename?: 'Pubkey';
  x: Scalars['String']['output'];
  y: Scalars['String']['output'];
};

export type Query = {
  __typename?: 'Query';
  _coverage: Coverage;
  _finality: Finality;
  _meta: _Meta_;
  account?: Maybe<Account>;
  accounts: Array<Account>;
  addressChangeds: Array<Event>;
  approvals: Array<ResolverApproval>;
  domain?: Maybe<Domain>;
  domainConnection: DomainConnection;
  domains: Array<Domain>;
  eventConnection: EventConnection;
  events: Array<Event>;
  expiryUpdateds: Array<Event>;
  fusesSets: Array<Event>;
  labelRegistereds: Array<Event>;
  metadata?: Maybe<ResolverMetadata>;
  nameRegistereds: Array<Event>;
  nameReneweds: Array<Event>;
  nameUnwrappeds: Array<Event>;
  nameWrappeds: Array<Event>;
  registrationConnection: RegistrationConnection;
  registrations: Array<Registration>;
  registries: Array<RegistryInfo>;
  registry?: Maybe<RegistryInfo>;
  registryTransfers: Array<Event>;
  resolver?: Maybe<ResolverDetail>;
  resolverUpdateds: Array<Event>;
  resolvers: Array<Resolver>;
  resolversByOwner: Array<ResolverDetail>;
  reverseClaimeds: Array<Event>;
  roleConnection: EacRoleAssignmentConnection;
  roles: Array<EacRoleAssignment>;
  textChangeds: Array<Event>;
  transfers: Array<Event>;
  wrappedDomains: Array<WrappedDomain>;
};


export type QueryAccountArgs = {
  id: Scalars['String']['input'];
};


export type QueryAccountsArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Account_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<AccountFilter>;
};


export type QueryAddressChangedsArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Event_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<EventFilter>;
};


export type QueryApprovalsArgs = {
  delegate?: InputMaybe<Scalars['String']['input']>;
  namehash?: InputMaybe<Scalars['String']['input']>;
};


export type QueryDomainArgs = {
  atBlock?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['String']['input'];
};


export type QueryDomainConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Domain_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  where?: InputMaybe<DomainFilter>;
};


export type QueryDomainsArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Domain_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<DomainFilter>;
};


export type QueryEventConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Event_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  where?: InputMaybe<EventFilter>;
};


export type QueryEventsArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Event_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<EventFilter>;
};


export type QueryExpiryUpdatedsArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Event_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<EventFilter>;
};


export type QueryFusesSetsArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Event_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<EventFilter>;
};


export type QueryLabelRegisteredsArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Event_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<EventFilter>;
};


export type QueryMetadataArgs = {
  resolver: Scalars['String']['input'];
};


export type QueryNameRegisteredsArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Event_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<EventFilter>;
};


export type QueryNameRenewedsArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Event_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<EventFilter>;
};


export type QueryNameUnwrappedsArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Event_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<EventFilter>;
};


export type QueryNameWrappedsArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Event_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<EventFilter>;
};


export type QueryRegistrationConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Registration_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  where?: InputMaybe<RegistrationFilter>;
};


export type QueryRegistrationsArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Registration_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<RegistrationFilter>;
};


export type QueryRegistriesArgs = {
  owner: Scalars['String']['input'];
};


export type QueryRegistryArgs = {
  address: Scalars['String']['input'];
};


export type QueryRegistryTransfersArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Event_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<EventFilter>;
};


export type QueryResolverArgs = {
  id: Scalars['String']['input'];
};


export type QueryResolverUpdatedsArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Event_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<EventFilter>;
};


export type QueryResolversArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Resolver_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<ResolverFilter>;
};


export type QueryResolversByOwnerArgs = {
  account: Scalars['String']['input'];
  protocol?: InputMaybe<Scalars['String']['input']>;
};


export type QueryReverseClaimedsArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Event_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<EventFilter>;
};


export type QueryRoleConnectionArgs = {
  account?: InputMaybe<Scalars['String']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  resource?: InputMaybe<Scalars['String']['input']>;
};


export type QueryRolesArgs = {
  account?: InputMaybe<Scalars['String']['input']>;
  resource?: InputMaybe<Scalars['String']['input']>;
};


export type QueryTextChangedsArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Event_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<EventFilter>;
};


export type QueryTransfersArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Event_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<EventFilter>;
};


export type QueryWrappedDomainsArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<WrappedDomainFilter>;
};

export type Registration = {
  __typename?: 'Registration';
  baseCost?: Maybe<Scalars['String']['output']>;
  cost?: Maybe<Scalars['String']['output']>;
  domain: Domain;
  expiryDate: Scalars['Int']['output'];
  id: Scalars['String']['output'];
  labelName?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  premium?: Maybe<Scalars['String']['output']>;
  protocol: Scalars['String']['output'];
  referrer?: Maybe<Scalars['String']['output']>;
  registrant: Account;
  registrationDate: Scalars['Int']['output'];
};

export type RegistrationConnection = {
  __typename?: 'RegistrationConnection';
  edges: Array<RegistrationEdge>;
  pageInfo: PageInfo;
  totalCount?: Maybe<Scalars['Int']['output']>;
};

export type RegistrationEdge = {
  __typename?: 'RegistrationEdge';
  cursor: Scalars['String']['output'];
  node: Registration;
};

export type RegistrationFilter = {
  and?: InputMaybe<Array<RegistrationFilter>>;
  expiryDate_gt?: InputMaybe<Scalars['Int']['input']>;
  expiryDate_gte?: InputMaybe<Scalars['Int']['input']>;
  expiryDate_lt?: InputMaybe<Scalars['Int']['input']>;
  expiryDate_lte?: InputMaybe<Scalars['Int']['input']>;
  or?: InputMaybe<Array<RegistrationFilter>>;
  protocol?: InputMaybe<Scalars['String']['input']>;
  registrant?: InputMaybe<Scalars['String']['input']>;
  registrant_in?: InputMaybe<Array<Scalars['String']['input']>>;
};

export enum Registration_OrderBy {
  ExpiryDate = 'expiryDate',
  Id = 'id',
  Name = 'name',
  RegistrationDate = 'registrationDate'
}

export type RegistryInfo = {
  __typename?: 'RegistryInfo';
  address: Scalars['String']['output'];
  createdAt: Scalars['Int']['output'];
  createdBlock: Scalars['Int']['output'];
  eventConnection: EventConnection;
  eventCount: Scalars['Int']['output'];
  events: Array<Event>;
  labelConnection: DomainConnection;
  labelCount: Scalars['Int']['output'];
  labels: Array<Domain>;
  name: Scalars['String']['output'];
  namehash: Scalars['String']['output'];
  owner?: Maybe<Account>;
  parentRegistry: Scalars['String']['output'];
  referencedBy: Array<Domain>;
  referencedByConnection: DomainConnection;
  referencedByCount: Scalars['Int']['output'];
  roleConnection: EacRoleAssignmentConnection;
  roleCount: Scalars['Int']['output'];
  roles: Array<EacRoleAssignment>;
};


export type RegistryInfoEventConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Event_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  where?: InputMaybe<EventFilter>;
};


export type RegistryInfoEventsArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<EventFilter>;
};


export type RegistryInfoLabelConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Domain_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  where?: InputMaybe<DomainFilter>;
};


export type RegistryInfoLabelsArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Domain_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<DomainFilter>;
};


export type RegistryInfoReferencedByArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Domain_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<DomainFilter>;
};


export type RegistryInfoReferencedByConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Domain_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  where?: InputMaybe<DomainFilter>;
};


export type RegistryInfoRoleConnectionArgs = {
  account?: InputMaybe<Scalars['String']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type RegistryInfoRolesArgs = {
  account?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
};

export type RegistryTransferData = {
  __typename?: 'RegistryTransferData';
  node?: Maybe<Scalars['String']['output']>;
  owner?: Maybe<Scalars['String']['output']>;
};

export type Resolver = {
  __typename?: 'Resolver';
  abis?: Maybe<Array<Scalars['Int']['output']>>;
  addr?: Maybe<Scalars['String']['output']>;
  address: Scalars['String']['output'];
  addresses?: Maybe<Array<CoinAddress>>;
  aliases?: Maybe<Array<Alias>>;
  coinTypes?: Maybe<Array<Scalars['String']['output']>>;
  contentHash?: Maybe<Scalars['String']['output']>;
  domain?: Maybe<Domain>;
  id: Scalars['String']['output'];
  interfaces?: Maybe<Array<InterfaceRecord>>;
  pubkey?: Maybe<Pubkey>;
  reverseName?: Maybe<Scalars['String']['output']>;
  text?: Maybe<Scalars['String']['output']>;
  texts?: Maybe<Array<Scalars['String']['output']>>;
  version?: Maybe<Scalars['Int']['output']>;
};


export type ResolverAddrArgs = {
  coinType?: InputMaybe<Scalars['Int']['input']>;
};


export type ResolverTextArgs = {
  key: Scalars['String']['input'];
};

export type ResolverApproval = {
  __typename?: 'ResolverApproval';
  approved: Scalars['Boolean']['output'];
  blockNumber: Scalars['Int']['output'];
  context?: Maybe<Scalars['String']['output']>;
  delegate: Scalars['String']['output'];
  id: Scalars['String']['output'];
  logIndex: Scalars['Int']['output'];
  namehash: Scalars['String']['output'];
  resolver: Scalars['String']['output'];
  timestamp: Scalars['Int']['output'];
  transactionHash: Scalars['String']['output'];
};

export type ResolverDetail = {
  __typename?: 'ResolverDetail';
  address: Scalars['String']['output'];
  aliasCount: Scalars['Int']['output'];
  aliases: Array<Alias>;
  events: Array<Event>;
  id: Scalars['String']['output'];
  namedResources: Array<NamedResourceEntry>;
  nodeCount: Scalars['Int']['output'];
  nodes: Array<Domain>;
  roleHolderCount: Scalars['Int']['output'];
  roles: Array<EacRoleAssignment>;
};


export type ResolverDetailEventsArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
};


export type ResolverDetailNodesArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
};

export type ResolverFilter = {
  address?: InputMaybe<Scalars['String']['input']>;
  address_in?: InputMaybe<Array<Scalars['String']['input']>>;
  namehash?: InputMaybe<Scalars['String']['input']>;
  protocol?: InputMaybe<Scalars['String']['input']>;
};

export type ResolverMetadata = {
  __typename?: 'ResolverMetadata';
  blockNumber: Scalars['Int']['output'];
  graphqlUrl: Scalars['String']['output'];
  id: Scalars['String']['output'];
  resolver: Scalars['String']['output'];
  timestamp: Scalars['Int']['output'];
  transactionHash: Scalars['String']['output'];
};

export type ResolverUpdatedData = {
  __typename?: 'ResolverUpdatedData';
  resolver?: Maybe<Scalars['String']['output']>;
  sender?: Maybe<Scalars['String']['output']>;
  tokenId?: Maybe<Scalars['String']['output']>;
};

export enum Resolver_OrderBy {
  Address = 'address',
  SetBlock = 'setBlock'
}

export type ReverseClaimedData = {
  __typename?: 'ReverseClaimedData';
  address?: Maybe<Scalars['String']['output']>;
  node?: Maybe<Scalars['String']['output']>;
};

export type TextChangedData = {
  __typename?: 'TextChangedData';
  key?: Maybe<Scalars['String']['output']>;
  namehash?: Maybe<Scalars['String']['output']>;
  resolver?: Maybe<Scalars['String']['output']>;
  value?: Maybe<Scalars['String']['output']>;
};

export type TransferData = {
  __typename?: 'TransferData';
  count?: Maybe<Scalars['Int']['output']>;
  from?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  labelhash?: Maybe<Scalars['String']['output']>;
  operator?: Maybe<Scalars['String']['output']>;
  owner?: Maybe<Scalars['String']['output']>;
  parentNode?: Maybe<Scalars['String']['output']>;
  subdomain?: Maybe<Scalars['String']['output']>;
  to?: Maybe<Scalars['String']['output']>;
  value?: Maybe<Scalars['String']['output']>;
};

export type WrappedDomain = {
  __typename?: 'WrappedDomain';
  domain: Domain;
  expiryDate?: Maybe<Scalars['Int']['output']>;
  fuses?: Maybe<Scalars['Int']['output']>;
  id: Scalars['String']['output'];
  name?: Maybe<Scalars['String']['output']>;
  owner?: Maybe<Account>;
};

export type WrappedDomainFilter = {
  expiryDate_gt?: InputMaybe<Scalars['Int']['input']>;
  expiryDate_lt?: InputMaybe<Scalars['Int']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  owner?: InputMaybe<Scalars['String']['input']>;
};

export type _Block_ = {
  __typename?: '_Block_';
  hash?: Maybe<Scalars['String']['output']>;
  number: Scalars['Int']['output'];
  timestamp?: Maybe<Scalars['Int']['output']>;
};

export type _Meta_ = {
  __typename?: '_Meta_';
  block: _Block_;
  deployment?: Maybe<Scalars['String']['output']>;
  hasIndexingErrors: Scalars['Boolean']['output'];
};

export type AccountFragment = { __typename?: 'Account', id: string };

export type DomainFragment = { __typename?: 'Domain', id: string, name?: string | null, normalizedName?: string | null, tokenId?: string | null, createdAt: number, expiryDate?: number | null, resolver?: (
    { __typename?: 'Resolver' }
    & ResolverFragment
  ) | null, owner: (
    { __typename?: 'Account' }
    & AccountFragment
  ) };

export type ResolverFragment = { __typename?: 'Resolver', id: string, address: string, texts?: Array<string> | null, contentHash?: string | null, addresses?: Array<{ __typename?: 'CoinAddress', coinType: number, address: string }> | null };

export type DomainQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DomainQuery = { __typename?: 'Query', domain?: (
    { __typename?: 'Domain' }
    & DomainFragment
  ) | null };

export type DomainsQueryVariables = Exact<{
  where: DomainFilter;
  first?: InputMaybe<Scalars['Int']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Domain_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
}>;


export type DomainsQuery = { __typename?: 'Query', domains: Array<(
    { __typename?: 'Domain' }
    & DomainFragment
  )> };

export type MigratedNamesCountQueryVariables = Exact<{
  where: DomainFilter;
}>;


export type MigratedNamesCountQuery = { __typename?: 'Query', domainConnection: { __typename?: 'DomainConnection', totalCount?: number | null } };

export type OwnedNamesCountQueryVariables = Exact<{
  where: RegistrationFilter;
}>;


export type OwnedNamesCountQuery = { __typename?: 'Query', registrationConnection: { __typename?: 'RegistrationConnection', totalCount?: number | null } };

export const Resolver = gql`
    fragment Resolver on Resolver {
  id
  address
  texts
  contentHash
  addresses {
    coinType
    address
  }
}
    `;
export const Account = gql`
    fragment Account on Account {
  id
}
    `;
export const Domain = gql`
    fragment Domain on Domain {
  id
  name
  normalizedName
  tokenId
  resolver {
    ...Resolver
  }
  owner {
    ...Account
  }
  createdAt
  expiryDate
}
    ${Resolver}
${Account}`;
export const DomainDocument = gql`
    query Domain($id: String!) {
  domain(id: $id) {
    ...Domain
  }
}
    ${Domain}`;
export const DomainsDocument = gql`
    query Domains($where: DomainFilter!, $first: Int, $skip: Int, $orderBy: Domain_orderBy, $orderDirection: OrderDirection) {
  domains(
    where: $where
    first: $first
    skip: $skip
    orderBy: $orderBy
    orderDirection: $orderDirection
  ) {
    ...Domain
  }
}
    ${Domain}`;
export const MigratedNamesCountDocument = gql`
    query MigratedNamesCount($where: DomainFilter!) {
  domainConnection(first: 0, where: $where) {
    totalCount
  }
}
    `;
export const OwnedNamesCountDocument = gql`
    query OwnedNamesCount($where: RegistrationFilter!) {
  registrationConnection(first: 0, where: $where) {
    totalCount
  }
}
    `;