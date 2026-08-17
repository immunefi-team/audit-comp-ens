import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { match } from 'ts-pattern'

export type PremiumLabel = {
  label: MessageDescriptor
  variant: 'premium-3' | 'premium-4'
}

export const getPremiumLabel = (
  labelLength: number,
): PremiumLabel | undefined =>
  match(labelLength)
    .with(
      3,
      () =>
        ({
          label: msg`3 character premium name`,
          variant: 'premium-3',
        }) as const,
    )
    .with(
      4,
      () =>
        ({
          label: msg`4 character premium name`,
          variant: 'premium-4',
        }) as const,
    )
    .otherwise(() => undefined)
