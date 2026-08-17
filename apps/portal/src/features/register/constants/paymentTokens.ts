import type { JSX, SVGProps } from 'react'
import { DAIcon } from '@/assets/dai-icon'
import { USDCIcon } from '@/assets/usdc-icon'
import {
  DAI_DECIMALS,
  SUPPORTED_TOKENS,
  USDC_DECIMALS,
} from '@/lib/constants/tokens'

export type PaymentToken = {
  readonly symbol: 'USDC' | 'DAI'
  readonly address: (typeof SUPPORTED_TOKENS)[keyof typeof SUPPORTED_TOKENS]
  readonly decimals: number
  readonly Icon: (props: SVGProps<SVGSVGElement>) => JSX.Element
}

export const PAYMENT_TOKENS = [
  {
    symbol: 'USDC',
    address: SUPPORTED_TOKENS.USDC,
    decimals: USDC_DECIMALS,
    Icon: USDCIcon,
  },
  {
    symbol: 'DAI',
    address: SUPPORTED_TOKENS.DAI,
    decimals: DAI_DECIMALS,
    Icon: DAIcon,
  },
] as const satisfies readonly PaymentToken[]
