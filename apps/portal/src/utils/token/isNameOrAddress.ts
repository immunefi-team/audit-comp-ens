import { isAddress } from 'viem'
import { isValidEnsName } from './isNormalized'

/**
 * Validates an "account" input used by the add-user / owner forms: either a
 * 0x-prefixed address or an ENS name.
 *
 * This replaces an HTML `pattern` regex, which couldn't express the real rules:
 * the ENSv2 contracts impose no character constraints on labels (only a 1–255
 * byte length), so the actual client-side rule is ENSIP-15 normalization —
 * exactly what `isValidEnsName` checks via `@adraffy/ens-normalize`. A regex
 * both rejected valid names (unicode/emoji, multi-label, single-label) and
 * accepted un-normalized ASCII.
 *
 * `isAddress` is non-strict so users can paste a non-checksummed address; the
 * checksum/resolution is handled downstream.
 *
 * The name must have at least two labels (i.e. contain a `.`). A bare
 * single label like `fox` is a valid ENS name string but not a resolvable
 * account — only TLDs are single-label — and would otherwise "resolve" via the
 * owner fallback in `resolveAddressOrName`.
 */
export const isNameOrAddress = (input: string) =>
  isAddress(input, { strict: false }) ||
  (input.includes('.') && isValidEnsName(input))
