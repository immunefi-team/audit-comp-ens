export const DOMAIN_RESULT_STATUSES = [
  'available',
  'premium',
  'registered',
  'grace',
] as const

export type DomainResultStatus = (typeof DOMAIN_RESULT_STATUSES)[number]

export const isRegisteredDomainResultStatus = (
  status: DomainResultStatus,
): status is Extract<DomainResultStatus, 'registered' | 'grace'> =>
  status === 'registered' || status === 'grace'

export const domainResultStatusFromGrace = (
  isInGrace: boolean,
): Extract<DomainResultStatus, 'registered' | 'grace'> =>
  isInGrace ? 'grace' : 'registered'
