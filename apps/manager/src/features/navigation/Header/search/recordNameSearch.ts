import { track } from '@/lib/posthog/events'

export const recordNameSearch = (name: string) => {
  try {
    const normalizedName = name.trim().toLowerCase()
    track('name:search_selected', {
      name: normalizedName,
      source: 'header_search',
    })
  } catch {
    // Non-critical analytics write — ignore failures.
  }
}
