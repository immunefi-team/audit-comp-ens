import {
  generatePatternDataURI,
  type PatternName,
  type PatternOptions,
} from '@ensdomains/etherloom'
import { useMemo } from 'react'

import { twm } from '@/utils/tailwind'

const etherloomPattern: PatternName = 'ENS Vertical Pairs'
const defaultEtherloomColor = '#0082BB'
const etherloomOptions = {
  cellSize: 10,
  height: 96,
  width: 96,
  padding: 10,
} satisfies PatternOptions

export type PatternAvatarProps = {
  readonly name: string
  readonly className?: string
  readonly color?: string | null
}

export const PatternAvatar = ({
  name,
  className,
  color,
}: PatternAvatarProps) => {
  const patternColor = color ?? defaultEtherloomColor
  const src = useMemo(
    () =>
      generatePatternDataURI(
        name,
        etherloomPattern,
        patternColor,
        etherloomOptions,
      ),
    [name, patternColor],
  )

  return (
    <div
      className={twm(
        'flex h-full w-full items-center justify-center overflow-hidden rounded-md border border-slate-200 shadow-inner',
        className,
      )}
    >
      <img
        alt={`${name} pattern`}
        className="h-full w-full object-cover"
        draggable={false}
        src={src}
      />
    </div>
  )
}
