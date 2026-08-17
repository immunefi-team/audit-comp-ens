const ABI_VALID_JSON_ERROR = 'ABI must be valid JSON'
const ABI_ARRAY_ERROR = 'ABI must be a JSON array'

type AbiValidationResult =
  | {
      success: true
      data: unknown[] | null
    }
  | {
      success: false
      message: string
    }

export const parseAbiRecord = (
  value: string | undefined,
): AbiValidationResult => {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return { success: true, data: null }

  try {
    const parsed: unknown = JSON.parse(trimmed)

    if (!Array.isArray(parsed)) {
      return { success: false, message: ABI_ARRAY_ERROR }
    }

    return { success: true, data: parsed }
  } catch {
    return { success: false, message: ABI_VALID_JSON_ERROR }
  }
}

export const validateAbi = (value: string | undefined): string | undefined => {
  const result = parseAbiRecord(value)
  if (result.success) return undefined
  return result.message
}
