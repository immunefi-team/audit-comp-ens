/**
 * Extracts a human-readable error message from an error object.
 * Handles the common pattern of errors with nested `cause` properties.
 *
 * @param error - The error object to extract message from
 * @param fallback - Fallback message if no error message is found
 * @returns The extracted error message or fallback
 *
 * @example
 * extractErrorMessage(queryError) // "Network request failed"
 * extractErrorMessage(null) // "Could not load data."
 * extractErrorMessage(error, "Custom fallback") // Uses custom fallback if no message
 */
export const extractErrorMessage = (
  error: unknown,
  fallback = 'Could not load data.',
): string => {
  if (!error) return fallback

  const causeMessage = (error as { cause?: Error }).cause?.message
  const errorMessage = (error as Error).message

  return causeMessage || errorMessage || fallback
}
