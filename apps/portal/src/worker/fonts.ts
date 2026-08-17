import ogSansFontUrl from '../assets/fonts/og/abc-monument-grotesk-medium.ttf?url'
import ogMonoFontUrl from '../assets/fonts/og/abc-monument-grotesk-mono-medium.ttf?url'
import ogSemiMonoFontUrl from '../assets/fonts/og/abc-monument-grotesk-semi-mono-medium.ttf?url'

const fontCache = new Map<string, Promise<ArrayBuffer | null>>()

function isSupportedSfnt(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false
  const sig = new DataView(buffer, 0, 4).getUint32(0, false)

  return sig === 0x00010000 || sig === 0x4f54544f || sig === 0x74746366
}

export function loadFontData(
  env: Env,
  requestUrl: string,
  fontPath: string,
): Promise<ArrayBuffer | null> {
  const cached = fontCache.get(fontPath)
  if (cached) return cached

  const promise = (async () => {
    const candidatePaths = fontPath.startsWith('/assets/')
      ? [fontPath, `/client${fontPath}`]
      : [fontPath]

    for (const candidatePath of candidatePaths) {
      try {
        const url = new URL(candidatePath, requestUrl).toString()
        const res = await env.ASSETS.fetch(new Request(url))
        if (!res.ok) continue

        const buffer = await res.arrayBuffer()
        if (!isSupportedSfnt(buffer)) continue

        return buffer
      } catch {
        // Ignore and try the next candidate.
      }
    }

    return null
  })()

  fontCache.set(fontPath, promise)
  return promise
}

export interface OgFonts {
  ogSansFont: ArrayBuffer | null
  ogMonoFont: ArrayBuffer | null
  ogSemiMonoFont: ArrayBuffer | null
}

export interface OgFontEntry {
  name: string
  data: ArrayBuffer
  weight: number
  style: string
}

export async function loadOgFonts(
  env: Env,
  requestUrl: string,
): Promise<OgFonts> {
  const [ogSansFont, ogMonoFont, ogSemiMonoFont] = await Promise.all([
    loadFontData(env, requestUrl, ogSansFontUrl),
    loadFontData(env, requestUrl, ogMonoFontUrl),
    loadFontData(env, requestUrl, ogSemiMonoFontUrl),
  ])
  return { ogSansFont, ogMonoFont, ogSemiMonoFont }
}

export function buildOgFontList(fonts: OgFonts): OgFontEntry[] {
  return [
    fonts.ogSansFont
      ? { name: 'OgSans', data: fonts.ogSansFont, weight: 500, style: 'normal' }
      : null,
    fonts.ogMonoFont
      ? { name: 'OgMono', data: fonts.ogMonoFont, weight: 500, style: 'normal' }
      : null,
    fonts.ogSemiMonoFont
      ? {
          name: 'OgSemiMono',
          data: fonts.ogSemiMonoFont,
          weight: 500,
          style: 'normal',
        }
      : null,
  ].filter((f): f is OgFontEntry => f !== null)
}
