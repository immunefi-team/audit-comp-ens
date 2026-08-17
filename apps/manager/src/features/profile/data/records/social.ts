interface SocialProfileValueNormalizerOptions {
  readonly hosts: readonly string[]
  readonly pathPrefixes?: readonly string[]
}

const urlLikePattern = /^[\w.-]+\.[a-z]{2,}(?:[/#?]|$)/i
const urlSchemePattern = /^[a-z][a-z\d+.-]*:\/\//i

const normalizeHost = (host: string): string =>
  host.toLowerCase().replace(/^www\./, '')

const parsePotentialUrl = (value: string): URL | undefined => {
  if (urlSchemePattern.test(value)) {
    try {
      return new URL(value)
    } catch {
      return undefined
    }
  }

  if (urlLikePattern.test(value)) {
    try {
      return new URL(`https://${value}`)
    } catch {
      return undefined
    }
  }

  return undefined
}

const decodePathSegment = (segment: string): string => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

const stripHandlePrefix = (value: string): string => value.replace(/^@+/, '')

const getProfileSegment = (
  segments: readonly string[],
  pathPrefixes: readonly string[],
): string | undefined => {
  if (pathPrefixes.length === 0) {
    return segments[0]
  }

  for (const prefix of pathPrefixes) {
    const prefixIndex = segments.indexOf(prefix)
    const profileSegment = segments[prefixIndex + 1]

    if (prefixIndex !== -1 && profileSegment) {
      return profileSegment
    }
  }

  return undefined
}

export const createSocialProfileValueNormalizer = ({
  hosts,
  pathPrefixes = [],
}: SocialProfileValueNormalizerOptions): ((value: string) => string) => {
  const allowedHosts = new Set(hosts.map(normalizeHost))

  return (value: string): string => {
    const trimmed = value.trim()
    const url = parsePotentialUrl(trimmed)

    if (!url || !allowedHosts.has(normalizeHost(url.hostname))) {
      return stripHandlePrefix(trimmed)
    }

    const segments = url.pathname
      .split('/')
      .filter(Boolean)
      .map(decodePathSegment)
    const profileSegment = getProfileSegment(segments, pathPrefixes)

    return profileSegment
      ? stripHandlePrefix(profileSegment)
      : stripHandlePrefix(trimmed)
  }
}
