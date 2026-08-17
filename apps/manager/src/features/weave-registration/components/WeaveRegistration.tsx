import { usePrefersReducedMotion } from '@ens-apps/weave-loader/hooks/usePrefersReducedMotion'
import { NameFill } from '@ens-apps/weave-loader/NameFill'
import { JACQUARD_PATTERN3_DYE_BLEED_OPTIONS } from '@ens-apps/weave-loader/presets'
import type { WeaveShaderOptions } from '@ens-apps/weave-loader/shader/useWeaveShader'
import { WeaveCanvas } from '@ens-apps/weave-loader/WeaveCanvas'
import {
  WEAVE_REGISTRATION_HEADLINE_NAME_GAP_MIN_PX,
  WEAVE_REGISTRATION_TALL_NAME_DESKTOP_GAP_PX,
  WEAVE_REGISTRATION_TALL_NAME_LINE_THRESHOLD,
  weaveRegistrationNameFillFor,
} from '@ens-apps/weave-loader/weaveNameFill'
import { useLingui } from '@lingui/react/macro'
import { Calligraph } from 'calligraph'
import { type ReactNode, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  stepMessageForProgress,
  WEAVE_REGISTRATION_STEP_LABEL_HEIGHT_MOBILE_PX,
  WEAVE_REGISTRATION_STEP_LABEL_HEIGHT_PX,
} from '../lib/weaveSteps'

export interface WeaveRegistrationProps {
  name: string
  progress: number
  description?: string
  animate?: boolean
  footer?: ReactNode
  weaveOptions?: WeaveShaderOptions
  onFillSettled?: () => void
}

const WeaveRegistrationStepLabel = ({
  label,
  className,
}: {
  label: string
  className?: string
}) => {
  // Render one Calligraph per word so the line can only break between words,
  // never mid-word. Calligraph lays each grapheme out as an inline-flex item,
  // so a single instance under `flex-wrap` breaks at any character; making the
  // whole word the flex item fixes that. The column gap stands in for the
  // spaces we split on.
  const words = label.split(' ').filter(Boolean)
  return (
    <p
      aria-live="polite"
      className={cn(
        'flex min-w-0 shrink-0 flex-wrap gap-x-[0.28em] font-medium font-sans',
        className,
      )}
    >
      {words.map((word, index) => (
        <Calligraph
          animation="smooth"
          as="span"
          autoSize={false}
          initial
          // biome-ignore lint/suspicious/noArrayIndexKey: positional key keeps character diffing stable as the step message changes
          key={index}
          trend={1}
        >
          {word}
        </Calligraph>
      ))}
    </p>
  )
}

export const WeaveRegistration = ({
  name,
  progress,
  description,
  animate = true,
  footer,
  weaveOptions = JACQUARD_PATTERN3_DYE_BLEED_OPTIONS,
  onFillSettled,
}: WeaveRegistrationProps) => {
  const { i18n } = useLingui()
  const p = Math.max(0, Math.min(1, progress / 100))
  const stepMessage = stepMessageForProgress(p)
  const stepLabel = stepMessage ? i18n._(stepMessage) : ''
  const [nameLineCount, setNameLineCount] = useState(1)
  const nameFillTypography = weaveRegistrationNameFillFor(name)
  const singleLineName = nameLineCount <= 1
  const tallName = nameLineCount >= WEAVE_REGISTRATION_TALL_NAME_LINE_THRESHOLD

  const reducedMotion = usePrefersReducedMotion()
  const resolvedWeaveOptions = reducedMotion
    ? { ...weaveOptions, shimmer: false, animated: false }
    : weaveOptions
  const nameAnimate = animate && !reducedMotion

  return (
    <div className="weave-registration mx-auto flex w-full max-w-full flex-col items-center gap-8">
      <div
        className={cn(
          'inline-flex w-full max-w-[290px] gap-12 max-md:flex-col max-md:items-center max-md:gap-3 max-md:text-center md:w-auto md:max-w-none',
          singleLineName
            ? 'md:h-[210px] md:items-end'
            : 'md:min-h-[210px] md:items-stretch',
        )}
      >
        <div
          className="w-full shrink-0 md:hidden"
          style={{ height: WEAVE_REGISTRATION_STEP_LABEL_HEIGHT_MOBILE_PX }}
        >
          <WeaveRegistrationStepLabel
            className="mx-auto w-full max-w-[225px] justify-center text-center text-[#3e3e3e] text-base leading-[90%] tracking-[-0.4px]"
            label={stepLabel}
          />
        </div>

        <div className="shrink-0 overflow-hidden rounded-2xl max-md:size-[225px] md:h-[210px] md:w-[199px]">
          <WeaveCanvas options={resolvedWeaveOptions} />
        </div>

        <div
          className={cn(
            'flex w-[333px] min-w-0 flex-col max-md:w-full',
            singleLineName
              ? 'md:h-[210px] md:justify-between'
              : 'md:min-h-[210px]',
          )}
        >
          <div
            className="hidden shrink-0 md:block"
            style={
              singleLineName
                ? undefined
                : { height: WEAVE_REGISTRATION_STEP_LABEL_HEIGHT_PX }
            }
          >
            <WeaveRegistrationStepLabel
              className="w-full text-[32px] text-ens-quartz-450 leading-[90%] tracking-[-0.8px]"
              label={stepLabel}
            />
          </div>
          {singleLineName ? null : (
            <div
              aria-hidden
              className="shrink-0 max-md:hidden"
              style={{
                minHeight: tallName
                  ? WEAVE_REGISTRATION_TALL_NAME_DESKTOP_GAP_PX
                  : WEAVE_REGISTRATION_HEADLINE_NAME_GAP_MIN_PX,
              }}
            />
          )}
          <NameFill
            animate={nameAnimate}
            className={cn(
              'w-full shrink-0 whitespace-normal break-all max-md:mt-3 max-md:text-center',
              !singleLineName && !tallName && 'mt-[18px]',
            )}
            name={name}
            onFillSettled={onFillSettled}
            onLineCountChange={setNameLineCount}
            progress={p}
            {...nameFillTypography}
          />
        </div>
      </div>
      {description ? (
        <p className="text-center text-ens-gray text-sm">{description}</p>
      ) : null}
      {footer}
    </div>
  )
}
