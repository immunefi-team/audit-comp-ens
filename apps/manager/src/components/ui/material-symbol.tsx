import { type ClassValue, clsx } from 'clsx'
import type React from 'react'
import { createElement } from 'react'

type RangeOrValue = `${number}..${number}` | `${number}`

const OPTICAL_SIZE: RangeOrValue = '20..48'
const WEIGHT: RangeOrValue = '100..700'
const FILL: RangeOrValue = '0..1'
const GRADE: RangeOrValue = '-50..200'

/**
 * List of Material Symbols icons to load.
 *
 * @see {@link https://fonts.google.com/icons Material Symbols} for available icon names
 */
export const MATERIAL_SYMBOLS = [
  'account_balance_wallet',
  'account_circle',
  'add',
  'add_location_alt',
  'arrow_back',
  'arrow_drop_down',
  'arrow_forward',
  'arrow_outward',
  'arrow_shape_up_stack',
  'auto_awesome',
  'badge',
  'cached',
  'calendar_clock',
  'calendar_month',
  'captive_portal',
  'check',
  'close',
  'computer',
  'content_copy',
  'dashboard',
  'dehaze',
  'delete',
  'distance',
  'double_arrow',
  'download',
  'drafts',
  'edit',
  'face',
  'favorite',
  'fingerprint',
  'history',
  'hourglass',
  'info',
  'ios_share',
  'image',
  'key_vertical',
  'keyboard_arrow_down',
  'language',
  'language_chinese_array',
  'link',
  'login',
  'logout',
  'mail',
  'message',
  'more_horiz',
  'movie',
  'notification_settings',
  'notifications',
  'notifications_unread',
  'priority_high',
  'receipt_long',
  'redeem',
  'remove',
  'schedule',
  'search',
  'sentiment_calm',
  'settings',
  'share',
  'text_ad',
  'text_fields_alt',
  'translate',
  'undo',
  'upload',
  'wall_art',
  'warning',
  'waving_hand',
  'zoom_in',
  'zoom_out',
] as const satisfies readonly string[]

export type MaterialSymbol = (typeof MATERIAL_SYMBOLS)[number]

// Google Fonts requires the icons to be sorted alphabetically
const MATERIAL_SYMBOLS_SORTED = (MATERIAL_SYMBOLS as unknown as string[]).sort(
  (a, b) => a.localeCompare(b),
) as readonly MaterialSymbol[]

/**
 * Google Fonts URL for Material Symbols with variable font settings.
 * This URL is configured to load only the symbols defined in MATERIAL_SYMBOLS
 * to optimize font loading performance.
 *
 * Lives in a JSX-free module so it can be imported from non-React contexts
 * (e.g. `.storybook/main.ts`) without esbuild trying to parse JSX.
 */
export const MATERIAL_SYMBOLS_URL = `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@${OPTICAL_SIZE},${WEIGHT},${FILL},${GRADE}&icon_names=${MATERIAL_SYMBOLS_SORTED.join(',')}&display=block`
export interface MaterialSymbolProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'symbol' | 'className'>,
    React.RefAttributes<HTMLSpanElement> {
  symbol: MaterialSymbol
  className?: ClassValue
}
/**
 * Material Symbol component for rendering Google Material Symbols icons.
 *
 * This component renders Material Symbols icons with support for Tailwind utility classes
 * to control weight, fill, grade, and optical size. All utilities support Tailwind modifiers
 * like hover, focus, breakpoints, etc.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <MSymbol symbol="notifications" />
 *
 * // With weight utility
 * <MSymbol symbol="drafts" className="ms-wght-600" />
 *
 * // With hover modifier
 * <MSymbol symbol="notifications" className="ms-wght-400 hover:ms-wght-700" />
 *
 * // With fill and responsive sizing
 * <MSymbol
 *   symbol="drafts"
 *   className="ms-fill ms-opsz-24 md:ms-opsz-40 hover:ms-wght-600"
 * />
 *
 * // With grade for emphasis
 * <MSymbol
 *   symbol="notifications"
 *   className="ms-grade-emphasis ms-wght-500"
 * />
 *
 * // Combining multiple utilities
 * <MSymbol
 *   symbol="drafts"
 *   className="ms-wght-300 ms-opsz-20 hover:ms-wght-600 hover:ms-fill focus:ms-grade-emphasis"
 * />
 * ```
 *
 * @param props - Component props
 * @param props.symbol - The Material Symbol icon name (must be one of the symbols in MATERIAL_SYMBOLS)
 * @param props.className - Optional className string or ClassValue for Tailwind utilities
 *
 * @see {@link https://fonts.google.com/icons Material Symbols} for available icon names
 */
export const MSymbol = ({
  symbol,
  className,
  ...props
}: MaterialSymbolProps) => {
  return createElement(
    'span',
    { className: clsx('material-symbol', className), ...props },
    symbol,
  )
}
