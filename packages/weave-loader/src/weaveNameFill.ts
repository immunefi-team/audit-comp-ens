import type { NameFillProps } from './NameFill'

export const WEAVE_REGISTRATION_NAME_FILL = {
  baseColor: '#D3D3D3',
  fill: '#000000',
  fontFamily: 'var(--font-mono)',
  fontSize: 31.68,
  fontWeight: 500,
  letterSpacing: '-1.267px',
  lineHeight: '90%',
} as const satisfies Pick<
  NameFillProps,
  | 'baseColor'
  | 'fill'
  | 'fontFamily'
  | 'fontSize'
  | 'fontWeight'
  | 'letterSpacing'
  | 'lineHeight'
>

export const WEAVE_REGISTRATION_NAME_FILL_SMALL_FONT_THRESHOLD =
  'thisisanincrediblylongnametotestlongnameswiththisisani'.length

export const WEAVE_REGISTRATION_NAME_FILL_COMPACT = {
  ...WEAVE_REGISTRATION_NAME_FILL,
  fontSize: 24,
} as const satisfies Pick<
  NameFillProps,
  | 'baseColor'
  | 'fill'
  | 'fontFamily'
  | 'fontSize'
  | 'fontWeight'
  | 'letterSpacing'
  | 'lineHeight'
>

export function weaveRegistrationNameFillFor(name: string) {
  return name.length > WEAVE_REGISTRATION_NAME_FILL_SMALL_FONT_THRESHOLD
    ? WEAVE_REGISTRATION_NAME_FILL_COMPACT
    : WEAVE_REGISTRATION_NAME_FILL
}

export const WEAVE_REGISTRATION_HEADLINE_NAME_GAP_MIN_PX = 24

export const WEAVE_REGISTRATION_CANVAS_WIDTH_PX = 199
export const WEAVE_REGISTRATION_CANVAS_HEIGHT_PX = 210

export const WEAVE_REGISTRATION_CANVAS_MOBILE_SIZE_PX = 225

export const WEAVE_REGISTRATION_TALL_NAME_LINE_THRESHOLD = 3

export const WEAVE_REGISTRATION_TALL_NAME_DESKTOP_GAP_PX = 6

export const WEAVE_REGISTRATION_LONG_NAME =
  'thisisanincrediblylongnametotestlongnameswiththisisanincrediblylongnametotestlongnameswiththisisanincrediblylongnametotestlongnameswiththisisanincrediblylongnametotestlongnameswiththisisanincrediblylongnametotestlongnameswiththisisanincrediblylongnamt.eth'
