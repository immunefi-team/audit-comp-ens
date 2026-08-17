import { ImageResponse } from 'workers-og'

import ensMarkSvg from '../assets/fonts/og/ens-mark.svg?raw'
import ensLogoSvg from '../assets/fonts/og/Logo.svg?raw'
import shieldIconSvg from '../assets/fonts/og/shield-icon.svg?raw'
import syncIconSvg from '../assets/fonts/og/sync-icon.svg?raw'
import walletIconSvg from '../assets/fonts/og/wallet-icon.svg?raw'

import { buildOgFontList, loadOgFonts, type OgFonts } from './fonts'
import { truncate, truncateAddress } from './routing'

const matchHtmlRegExp = /["'&<>]/

export function escapeHtml(str: string): string {
  const match = matchHtmlRegExp.exec(str)

  if (!match) return String(str)

  let escapeChar: string
  let html = ''
  let index = 0
  let lastIndex = 0

  for (index = match.index; index < str.length; index++) {
    switch (str.charCodeAt(index)) {
      case 34: // "
        escapeChar = '&quot;'
        break
      case 38: // &
        escapeChar = '&amp;'
        break
      case 39: // '
        escapeChar = '&#39;'
        break
      case 60: // <
        escapeChar = '&lt;'
        break
      case 62: // >
        escapeChar = '&gt;'
        break
      default:
        continue
    }

    if (lastIndex !== index) html += str.substring(lastIndex, index)

    lastIndex = index + 1
    html += escapeChar
  }

  return lastIndex !== index ? html + str.substring(lastIndex, index) : html
}

const NAME_SUBPAGE_LABELS: Record<string, string> = {
  ownership: 'Ownership',
  records: 'Records',
  registry: 'Registry',
  resolver: 'Resolver',
  subnames: 'Subnames',
  roles: 'Roles',
}

const ADDR_SUBPAGE_LABELS: Record<string, string> = {
  names: 'Names',
  history: 'History',
  resolution: 'Address Resolution',
  'reverse-resolution': 'Reverse Resolution',
}

const RESOLVER_SUBPAGE_LABELS: Record<string, string> = {
  nodes: 'Nodes',
  roles: 'Roles',
  aliases: 'Aliases',
  'create-alias': 'Create Alias',
  history: 'History',
}

const REGISTRY_SUBPAGE_LABELS: Record<string, string> = {
  labels: 'Labels',
  roles: 'Roles',
  history: 'History',
}

function getPageLabel(
  subpage: string | null,
  labels: Record<string, string>,
  defaultLabel: string,
): string {
  return subpage
    ? (labels[subpage] ??
        `${subpage.charAt(0).toUpperCase()}${subpage.slice(1)}`)
    : defaultLabel
}

/**
 * Rasterise a card, or `null` when the render fails.
 *
 * satori/resvg run in a WASM instance that is a per-isolate singleton whose
 * linear memory only ever grows, so a render can throw for reasons unrelated to
 * this particular request — an avatar large enough in *pixels* (the size cap in
 * `ens.ts` bounds encoded bytes, not decoded area) exhausts that heap on a warm
 * isolate while the same request succeeds on a cold one.
 *
 * Nothing above this used to catch, so such a throw escaped to the runtime as a
 * 1101 and the card 500'd on `/<name>` and every subpage at once. Failures are
 * reported as `null` instead, and callers degrade to something renderable.
 */
async function renderOgResponse(
  html: string,
  fonts: OgFonts,
): Promise<Response | null> {
  let buf: ArrayBuffer
  try {
    const imageResponse = new ImageResponse(html, {
      width: 1200,
      height: 630,
      fonts: buildOgFontList(fonts),
    })
    buf = await imageResponse.arrayBuffer()
  } catch {
    return null
  }

  // workers-og can also fail by producing no bytes rather than throwing.
  if (buf.byteLength === 0) return null

  return new Response(buf, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}

function renderOgHeader(): string {
  return `
    <div style="position: absolute; left: 48px; top: 46px; display: flex; align-items: flex-start;">
      <img src="data:image/svg+xml;base64,${btoa(ensLogoSvg)}" width="370" height="51" style="width: 370px; height: 51px;" />
    </div>`
}

function nameOgHtml(
  name: string,
  avatar: string | null,
  owner: string | null,
  subpage: string | null,
): string {
  const available = !owner
  const displayName = truncate(name, 28)
  const headerHtml = renderOgHeader()
  const pageLabel = getPageLabel(subpage, NAME_SUBPAGE_LABELS, 'Name Overview')

  let html: string
  if (available) {
    html = `
    <div style="position: relative; width: 100%; height: 100%; background: white; display: flex; align-items: center; justify-content: center; padding: 100px; box-sizing: border-box;">
      <div style="display: flex; align-items: center; gap: 48px; width: 100%;">
        <img src="data:image/svg+xml;base64,${btoa(ensMarkSvg)}" width="126" height="140" style="width: 126px; height: 140px; flex-shrink: 0;" />
        <div style="display: flex; flex-direction: column; gap: 20px; color: #191919; min-width: 0; flex: 1;">
          <h1 style="margin: 0; font-size: 82px; line-height: 0.95; font-weight: 500; font-family: 'OgSemiMono', ui-monospace, monospace; overflow: hidden; max-height: 156px; word-break: break-all;">
            ${escapeHtml(displayName)}
          </h1>
          <p style="margin: 0; font-size: 40px; line-height: 0.75; font-weight: 500; font-family: 'OgMono', ui-monospace, monospace; white-space: nowrap; overflow: hidden;">
            Available to register
          </p>
        </div>
      </div>
      ${headerHtml}
    </div>
  `
  } else {
    const displayAddress = truncateAddress(owner, 6, 5)
    const avatarHtml = avatar
      ? `<img src="${escapeHtml(avatar)}" width="140" height="140" style="width: 140px; height: 140px; border-radius: 8px; object-fit: cover;" />`
      : `<div style="width: 140px; height: 140px; border-radius: 8px; background: #0082BB; display: flex; align-items: center; justify-content: center; color: white; font-size: 48px; font-weight: 500; font-family: 'OgSemiMono', ui-monospace, monospace;">${escapeHtml(name.charAt(0).toUpperCase())}</div>`

    html = `
    <div style="position: relative; width: 100%; height: 100%; background: #ECECEC; display: flex; align-items: center; justify-content: center; padding: 100px 75px; box-sizing: border-box;">
      <div style="display: flex; align-items: center; gap: 48px; width: 100%;">
        <div style="width: 140px; height: 140px; border-radius: 8px; background: #0082BB; overflow: hidden; flex-shrink: 0; display: flex;">${avatarHtml}</div>
        <div style="display: flex; flex-direction: column; gap: 20px; color: #191919; min-width: 0; flex: 1;">
          <h1 style="margin: 0; font-size: 82px; line-height: 0.95; font-weight: 500; font-family: 'OgSemiMono', ui-monospace, monospace; overflow: hidden; max-height: 156px; word-break: break-all;">
            ${escapeHtml(displayName)}
          </h1>
          <p style="margin: 0; font-size: 40px; line-height: 0.75; font-weight: 500; font-family: 'OgMono', ui-monospace, monospace; white-space: nowrap; overflow: hidden;">
            ${escapeHtml(displayAddress)}
          </p>
        </div>
      </div>
      ${headerHtml}
      <div style="position: absolute; right: 48px; bottom: 70px; transform: translateY(50%); font-size: 49px; line-height: 1; color: #000000; font-family: 'OgSans', system-ui, sans-serif; font-weight: 500; text-align: right; display: flex;">
        ${escapeHtml(pageLabel)}
      </div>
    </div>
  `
  }

  return html
}

/**
 * Render the name card, falling back to the avatar-less variant if the avatar
 * is what the renderer choked on.
 *
 * The avatar is the only part of this card whose cost is set by someone else —
 * every other element is fixed-size markup we control — so a render that fails
 * with one and succeeds without it is the expected shape of the failure. The
 * fallback is the same initial-letter tile a name with no avatar record gets.
 */
export async function renderOgImage(
  name: string,
  avatar: string | null,
  owner: string | null,
  requestUrl: string,
  env: Env,
  subpage: string | null = null,
): Promise<Response | null> {
  const fonts = await loadOgFonts(env, requestUrl)

  const rendered = await renderOgResponse(
    nameOgHtml(name, avatar, owner, subpage),
    fonts,
  )
  if (rendered || !avatar) return rendered

  return renderOgResponse(nameOgHtml(name, null, owner, subpage), fonts)
}

export async function renderAddressOgImage(
  address: string,
  requestUrl: string,
  env: Env,
  subpage: string | null = null,
): Promise<Response | null> {
  const fonts = await loadOgFonts(env, requestUrl)
  const displayAddress = truncateAddress(address, 6, 5)
  const headerHtml = renderOgHeader()
  const pageLabel = getPageLabel(
    subpage,
    ADDR_SUBPAGE_LABELS,
    'Address Overview',
  )

  const html = `
    <div style="position: relative; width: 100%; height: 100%; background: white; display: flex; align-items: center; justify-content: center; padding: 100px; box-sizing: border-box;">
      <div style="display: flex; align-items: center; gap: 48px; width: 100%;">
        <div style="width: 140px; height: 140px; border-radius: 8px; background: #ECECEC; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <img src="data:image/svg+xml;base64,${btoa(walletIconSvg)}" width="93" height="82" style="width: 93px; height: 82px;" />
        </div>
        <div style="display: flex; flex-direction: column; gap: 20px; color: #191919; min-width: 0; flex: 1;">
          <h1 style="margin: 0; font-size: 82px; line-height: 0.95; font-weight: 500; font-family: 'OgMono', ui-monospace, monospace; white-space: nowrap; overflow: hidden;">
            ${escapeHtml(displayAddress)}
          </h1>
        </div>
      </div>
      ${headerHtml}
      <div style="position: absolute; right: 48px; bottom: 70px; transform: translateY(50%); font-size: 49px; line-height: 1; color: #000000; font-family: 'OgSans', system-ui, sans-serif; font-weight: 500; text-align: right; display: flex;">
        ${escapeHtml(pageLabel)}
      </div>
    </div>
  `

  return renderOgResponse(html, fonts)
}

/**
 * Render a contract-style OG card (resolver / registry).
 *
 * Visually matches the name/address cards: a left icon, the truncated contract
 * address as the title, a contract-type subtitle, and the page label in the
 * bottom-right corner. The icon sits on a transparent background (no grey box)
 * to match the Figma resolver layout.
 */
async function renderContractOgImage(params: {
  address: string
  iconSvg: string
  iconWidth: number
  iconHeight: number
  subtitle: string
  pageLabel: string
  requestUrl: string
  env: Env
}): Promise<Response | null> {
  const fonts = await loadOgFonts(params.env, params.requestUrl)
  const displayAddress = truncateAddress(params.address, 6, 5)
  const headerHtml = renderOgHeader()

  const html = `
    <div style="position: relative; width: 100%; height: 100%; background: white; display: flex; align-items: center; justify-content: center; padding: 100px; box-sizing: border-box;">
      <div style="display: flex; align-items: center; gap: 48px; width: 100%;">
        <div style="width: 140px; height: 140px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <img src="data:image/svg+xml;base64,${btoa(params.iconSvg)}" width="${params.iconWidth}" height="${params.iconHeight}" style="width: ${params.iconWidth}px; height: ${params.iconHeight}px;" />
        </div>
        <div style="display: flex; flex-direction: column; gap: 20px; color: #191919; min-width: 0; flex: 1;">
          <h1 style="margin: 0; font-size: 82px; line-height: 0.95; font-weight: 500; font-family: 'OgMono', ui-monospace, monospace; white-space: nowrap; overflow: hidden;">
            ${escapeHtml(displayAddress)}
          </h1>
          <p style="margin: 0; font-size: 40px; line-height: 0.75; font-weight: 500; font-family: 'OgMono', ui-monospace, monospace; white-space: nowrap; overflow: hidden;">
            ${escapeHtml(params.subtitle)}
          </p>
        </div>
      </div>
      ${headerHtml}
      <div style="position: absolute; right: 48px; bottom: 70px; transform: translateY(50%); font-size: 49px; line-height: 1; color: #000000; font-family: 'OgSans', system-ui, sans-serif; font-weight: 500; text-align: right; display: flex;">
        ${escapeHtml(params.pageLabel)}
      </div>
    </div>
  `

  return renderOgResponse(html, fonts)
}

/** Resolver card subtitle — "Permissioned Resolver" for audited instances. */
export function resolverSubtitle(isPermissioned: boolean): string {
  return isPermissioned ? 'Permissioned Resolver' : 'Resolver'
}

/** Resolver card page label for the given subpage (defaults to overview). */
export function resolverPageLabel(subpage: string | null): string {
  return getPageLabel(subpage, RESOLVER_SUBPAGE_LABELS, 'Resolver Overview')
}

/** Registry card page label for the given subpage (defaults to overview). */
export function registryPageLabel(subpage: string | null): string {
  return getPageLabel(subpage, REGISTRY_SUBPAGE_LABELS, 'Registry Overview')
}

export async function renderResolverOgImage(
  address: string,
  requestUrl: string,
  env: Env,
  subpage: string | null = null,
  isPermissioned = false,
): Promise<Response | null> {
  return renderContractOgImage({
    address,
    // Sync icon (per Figma) rendered at its native 93×90 aspect ratio.
    iconSvg: syncIconSvg,
    iconWidth: 93,
    iconHeight: 90,
    subtitle: resolverSubtitle(isPermissioned),
    pageLabel: resolverPageLabel(subpage),
    requestUrl,
    env,
  })
}

export async function renderRegistryOgImage(
  address: string,
  requestUrl: string,
  env: Env,
  subpage: string | null = null,
): Promise<Response | null> {
  return renderContractOgImage({
    address,
    // Shield icon rendered at its native 25×31 aspect ratio (scaled up).
    iconSvg: shieldIconSvg,
    iconWidth: 89,
    iconHeight: 110,
    subtitle: 'Registry',
    pageLabel: registryPageLabel(subpage),
    requestUrl,
    env,
  })
}

export async function renderDefaultOgImage(
  requestUrl: string,
  env: Env,
): Promise<Response | null> {
  const fonts = await loadOgFonts(env, requestUrl)

  const html = `
    <div style="position: relative; width: 100%; height: 100%; background: white; display: flex; align-items: center; justify-content: center; padding: 100px; box-sizing: border-box;">
      <div style="display: flex; flex-direction: column; align-items: center; gap: 43px;">
        <img src="data:image/svg+xml;base64,${btoa(ensMarkSvg)}" width="126" height="140" style="width: 126px; height: 140px; border-radius: 8px;" />
        <span style="font-size: 85px; font-weight: 500; font-family: 'OgSans', system-ui, sans-serif; color: black; line-height: 1;">ENS Explorer</span>
      </div>
    </div>
  `

  return renderOgResponse(html, fonts)
}

export async function renderTldOgImage(
  tld: string,
  requestUrl: string,
  env: Env,
): Promise<Response | null> {
  const fonts = await loadOgFonts(env, requestUrl)
  const displayTld = tld.toUpperCase()
  const headerHtml = renderOgHeader()

  const html = `
    <div style="position: relative; width: 100%; height: 100%; background: #ECECEC; display: flex; align-items: center; justify-content: center; padding: 100px; box-sizing: border-box;">
      <div style="display: flex; align-items: center; width: 100%;">
        <div style="display: flex; flex-direction: column; gap: 20px; color: #191919; min-width: 0; flex: 1;">
          <h1 style="margin: 0; font-size: 72px; line-height: 1; font-weight: 500; font-family: 'OgSemiMono', ui-monospace, monospace; overflow: hidden; max-height: 144px; word-break: break-all;">
            ${escapeHtml(displayTld)}
          </h1>
          <p style="margin: 0; font-size: 36px; line-height: 1; font-weight: 500; font-family: 'OgMono', ui-monospace, monospace; white-space: nowrap; overflow: hidden;">
            Top Level Domain
          </p>
        </div>
      </div>
      ${headerHtml}
    </div>
  `

  return renderOgResponse(html, fonts)
}
