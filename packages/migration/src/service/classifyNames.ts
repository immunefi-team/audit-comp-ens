import { ChildFuses, FullParentFuses } from '@ensdomains/ensjs/utils'
import { type Address, isAddress } from 'viem'
import { isKnownPublicResolver } from '../contracts/knownResolvers'
import { GRACE_PERIOD_SECONDS } from './constants'
import type { V1Domain } from './v1SubgraphClient'

const toAddress = (s: string | null | undefined): Address | null => {
  if (!s) return null
  return isAddress(s) ? (s as Address) : null
}

export const FUSES = {
  CAN_DO_EVERYTHING: 0n,
  CANNOT_UNWRAP: ChildFuses.CANNOT_UNWRAP,
  CANNOT_BURN_FUSES: ChildFuses.CANNOT_BURN_FUSES,
  CANNOT_TRANSFER: ChildFuses.CANNOT_TRANSFER,
  CANNOT_SET_RESOLVER: ChildFuses.CANNOT_SET_RESOLVER,
  CANNOT_SET_TTL: ChildFuses.CANNOT_SET_TTL,
  CANNOT_CREATE_SUBDOMAIN: ChildFuses.CANNOT_CREATE_SUBDOMAIN,
  CANNOT_APPROVE: ChildFuses.CANNOT_APPROVE,
  PARENT_CANNOT_CONTROL: FullParentFuses.PARENT_CANNOT_CONTROL,
  IS_DOT_ETH: FullParentFuses.IS_DOT_ETH,
  CAN_EXTEND_EXPIRY: FullParentFuses.CAN_EXTEND_EXPIRY,
} as const

export type MigrationTokenType =
  | 'unwrapped'
  | 'unlocked'
  | 'locked-2ld'
  | 'locked-child'
  | 'detached-child'

export type IneligibleReason =
  | 'unlocked-subname'
  | 'expired-registration'
  | 'registry-only'
  | 'not-transferable'
  | 'missing-parent'
  | 'frozen-approval'
  | 'already-migrated'
  | 'unknown-label'

export type IneligibleName = {
  readonly domain: V1Domain
  readonly reason: IneligibleReason
}

type ResolverStrategy = 'keep-v1' | 'to-owned-permres'

export type ClassifiedName = {
  readonly domain: V1Domain
  readonly tokenType: MigrationTokenType
  readonly label: string
  readonly parentName: string | null
  readonly fuses: bigint
  readonly tokenHolder: Address
  readonly v1ResolverAddress: string | null
  readonly resolverStrategy: ResolverStrategy
  readonly managerAddress: Address | null
}

export const hasFuse = (fuses: bigint, fuse: bigint): boolean =>
  (fuses & fuse) !== 0n

const resolverStrategyFor = (params: {
  tokenType: MigrationTokenType
  fuses: bigint
  v1ResolverAddress: string | null
}): ResolverStrategy => {
  const { tokenType, fuses, v1ResolverAddress } = params

  const cannotSetResolverLocked =
    (tokenType === 'locked-2ld' || tokenType === 'locked-child') &&
    hasFuse(fuses, FUSES.CANNOT_SET_RESOLVER)

  // LockedWrapperReceiver ignores the resolver supplied in Migration.Data when
  // CANNOT_SET_RESOLVER is burned. It always reads the V1 registry instead,
  // including preserving address(0), so this path can never move to the HCA
  // resolver even when there is no existing resolver.
  if (cannotSetResolverLocked) {
    return 'keep-v1'
  }

  if (v1ResolverAddress && !isKnownPublicResolver(v1ResolverAddress)) {
    return 'keep-v1'
  }

  return 'to-owned-permres'
}

type ClassifyResult =
  | { type: 'classified'; name: ClassifiedName }
  | { type: 'ineligible'; name: IneligibleName }
  | null

const UNKNOWN_LABEL_PATTERN = /\[[0-9a-fA-F]{64}\]/
const hasUnknownLabel = (domain: V1Domain): boolean => {
  if (!domain.labelName) return true
  if (UNKNOWN_LABEL_PATTERN.test(domain.labelName)) return true
  if (UNKNOWN_LABEL_PATTERN.test(domain.name)) return true
  return false
}

const hasExpiredDotEthRegistration = (
  domain: V1Domain,
  parentName: string | null,
  nowSeconds: bigint,
): boolean => {
  if (parentName !== 'eth') return false
  const registrationExpiry = domain.registration?.expiryDate
  if (registrationExpiry) return BigInt(registrationExpiry) <= nowSeconds
  // Fall back to the wrapper expiry only while the name is genuinely in its
  // grace period: `wrapperExpiry - GRACE <= now < wrapperExpiry`. A wrapper
  // expiry fully in the past means the wrapper is stale/expired (the name has
  // reverted to its registrant) — not a grace-period registration — so it must
  // not be flagged here.
  const wrappedExpiry = domain.wrappedDomain?.expiryDate
  if (wrappedExpiry) {
    const expiry = BigInt(wrappedExpiry)
    return expiry - GRACE_PERIOD_SECONDS <= nowSeconds && nowSeconds < expiry
  }
  return false
}

export const classifyName = (
  domain: V1Domain,
  ownerAddress: Address,
): ClassifyResult => {
  if (hasUnknownLabel(domain)) {
    return { type: 'ineligible', name: { domain, reason: 'unknown-label' } }
  }
  const label = domain.labelName
  if (!label) return null

  const parentName = domain.parent?.name ?? null
  const addr = ownerAddress.toLowerCase()
  const v1ResolverAddress = domain.resolver?.address ?? null
  const nowSeconds = BigInt(Math.floor(Date.now() / 1000))
  const wrappedOwner = domain.wrappedOwner
  const wrappedOwnerMatches = wrappedOwner?.id.toLowerCase() === addr
  const effectiveWrappedDomain =
    domain.wrappedDomain &&
    (BigInt(domain.wrappedDomain.expiryDate) > nowSeconds ||
      wrappedOwnerMatches)
      ? domain.wrappedDomain
      : null

  if (!effectiveWrappedDomain) {
    const registrant = domain.registrant
    if (registrant?.id.toLowerCase() !== addr) return null
    if (parentName !== 'eth') return null
    if (hasExpiredDotEthRegistration(domain, parentName, nowSeconds)) {
      return {
        type: 'ineligible',
        name: { domain, reason: 'expired-registration' },
      }
    }

    const tokenHolder = toAddress(registrant.id)
    if (!tokenHolder) return null

    const registryOwnerAddress = toAddress(domain.owner.id)
    const managerAddress: Address | null =
      registryOwnerAddress &&
      registryOwnerAddress.toLowerCase() !== registrant.id.toLowerCase()
        ? registryOwnerAddress
        : null

    return {
      type: 'classified',
      name: {
        domain,
        tokenType: 'unwrapped',
        label,
        parentName,
        fuses: 0n,
        tokenHolder,
        v1ResolverAddress,
        resolverStrategy: resolverStrategyFor({
          tokenType: 'unwrapped',
          fuses: 0n,
          v1ResolverAddress,
        }),
        managerAddress,
      },
    }
  }

  if (!wrappedOwner || !wrappedOwnerMatches) return null

  const fuses = BigInt(effectiveWrappedDomain.fuses)
  const wrappedHolder = toAddress(wrappedOwner.id)
  if (!wrappedHolder) return null
  if (hasExpiredDotEthRegistration(domain, parentName, nowSeconds)) {
    return {
      type: 'ineligible',
      name: { domain, reason: 'expired-registration' },
    }
  }

  if (!hasFuse(fuses, FUSES.CANNOT_UNWRAP)) {
    if (parentName !== 'eth') {
      if (
        hasFuse(fuses, FUSES.PARENT_CANNOT_CONTROL) &&
        parentName &&
        domain.parent?.wrappedDomain &&
        hasFuse(BigInt(domain.parent.wrappedDomain.fuses), FUSES.CANNOT_UNWRAP)
      ) {
        return {
          type: 'classified',
          name: {
            domain,
            tokenType: 'detached-child',
            label,
            parentName,
            fuses,
            tokenHolder: wrappedHolder,
            v1ResolverAddress,
            resolverStrategy: resolverStrategyFor({
              tokenType: 'detached-child',
              fuses,
              v1ResolverAddress,
            }),
            managerAddress: null,
          },
        }
      }
      return {
        type: 'ineligible',
        name: { domain, reason: 'unlocked-subname' },
      }
    }
    return {
      type: 'classified',
      name: {
        domain,
        tokenType: 'unlocked',
        label,
        parentName,
        fuses,
        tokenHolder: wrappedHolder,
        v1ResolverAddress,
        resolverStrategy: resolverStrategyFor({
          tokenType: 'unlocked',
          fuses,
          v1ResolverAddress,
        }),
        managerAddress: null,
      },
    }
  }

  if (hasFuse(fuses, FUSES.CANNOT_TRANSFER)) {
    return { type: 'ineligible', name: { domain, reason: 'not-transferable' } }
  }
  if (!parentName) {
    return { type: 'ineligible', name: { domain, reason: 'missing-parent' } }
  }

  const lockedTokenType: MigrationTokenType =
    parentName === 'eth' ? 'locked-2ld' : 'locked-child'

  return {
    type: 'classified',
    name: {
      domain,
      tokenType: lockedTokenType,
      label,
      parentName,
      fuses,
      tokenHolder: wrappedHolder,
      v1ResolverAddress,
      resolverStrategy: resolverStrategyFor({
        tokenType: lockedTokenType,
        fuses,
        v1ResolverAddress,
      }),
      managerAddress: null,
    },
  }
}

export type ClassifyNamesResult = {
  readonly classified: ClassifiedName[]
  readonly ineligible: IneligibleName[]
}

export const classifyNames = (
  domains: V1Domain[],
  ownerAddress: Address,
): ClassifyNamesResult => {
  const classified: ClassifiedName[] = []
  const ineligible: IneligibleName[] = []

  for (const domain of domains) {
    const result = classifyName(domain, ownerAddress)
    if (!result) continue
    if (result.type === 'classified') {
      classified.push(result.name)
    } else {
      ineligible.push(result.name)
    }
  }

  return { classified, ineligible }
}
