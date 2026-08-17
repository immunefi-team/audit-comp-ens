import { isSafeHttpUrl, safeHttpUrlSchema } from '@ens-apps/shared-schema'

const SAFE_RECORD_HREF_PROTOCOLS = [
  'http:',
  'https:',
  'mailto:',
  'tel:',
  'ipfs:',
  'ar:',
] as const

export { isSafeHttpUrl }

export const safeHttpHref = (
  value: string | null | undefined,
): string | undefined => {
  const trimmed = value?.trim()
  if (!trimmed || !isSafeHttpUrl(trimmed)) return undefined
  return trimmed
}

export const isSafeRecordHref = (value: string): boolean => {
  const trimmed = value.trim()
  if (!trimmed) return false
  try {
    const parsedUrl = new URL(trimmed)
    return SAFE_RECORD_HREF_PROTOCOLS.includes(
      parsedUrl.protocol as (typeof SAFE_RECORD_HREF_PROTOCOLS)[number],
    )
  } catch {
    return false
  }
}

export const safeRecordHref = (
  value: string | null | undefined,
): string | undefined => {
  const trimmed = value?.trim()
  if (!trimmed || !isSafeRecordHref(trimmed)) return undefined
  return trimmed
}

export const isSafeImageSrc = isSafeHttpUrl

export const safeImageSrc = (
  value: string | null | undefined,
): string | undefined => {
  return safeHttpHref(value)
}

export const createSafeUrlSchema = (message: string) =>
  safeHttpUrlSchema(message)
