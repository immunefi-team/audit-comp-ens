import { Calligraph } from 'calligraph'
import type { ComponentProps } from 'react'
import { formatUsd } from '@/utils/formatting/formatUsdCeil'

/**
 * Money figure that animates with Calligraph's fluid character transition —
 * shared digits slide to their new positions while entering digits fade in
 * and exiting ones fade out. Deliberately NOT a slot-machine wheel, which
 * reads as "hectic" for the decaying temporary-premium fees.
 */

type Animation = ComponentProps<typeof Calligraph>['animation']

const ANIMATION_BY_EMPHASIS: Record<'soft' | 'active', Animation> = {
  soft: 'smooth',
  active: 'snappy',
}

type AnimatedPriceProps = {
  value: number
  emphasis?: 'soft' | 'active'
}

export const AnimatedPrice = ({
  value,
  emphasis = 'soft',
}: AnimatedPriceProps) => (
  <Calligraph animation={ANIMATION_BY_EMPHASIS[emphasis]} variant="number">
    {formatUsd(value)}
  </Calligraph>
)
