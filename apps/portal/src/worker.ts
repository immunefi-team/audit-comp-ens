import { withSecurityHeaders } from './worker/csp'
import { fetchEnsData, fetchIsPermissionedResolver } from './worker/ens'
import { MetaTagInjector, TitleRewriter } from './worker/html-rewriter'
import {
  escapeHtml,
  renderAddressOgImage,
  renderDefaultOgImage,
  renderOgImage,
  renderRegistryOgImage,
  renderResolverOgImage,
  renderTldOgImage,
} from './worker/og-render'
import {
  extractAddrFromPath,
  extractNameFromPath,
  extractRegisterName,
  extractTldFromPath,
  isAddressRoute,
  isAddrSubpage,
  isTldRoute,
  matchContractRoute,
  truncateAddress,
} from './worker/routing'

/** Only inject meta tags / render OG cards for navigations, not asset fetches. */
function wantsHtml(request: Request): boolean {
  const accept = request.headers.get('Accept') ?? ''
  return accept.includes('text/html') || accept.includes('*/*')
}

interface MetaTagOptions {
  title: string
  description: string
  imageUrl: string
  type?: 'website' | 'profile'
  imageAlt?: string | null
}

/** Build the shared OG / Twitter meta tag block. */
function buildMetaTags({
  title,
  description,
  imageUrl,
  type = 'website',
  imageAlt = null,
}: MetaTagOptions): string {
  return [
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:image" content="${escapeHtml(imageUrl)}" />`,
    `<meta property="og:type" content="${type}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`,
    imageAlt
      ? `<meta property="og:image:alt" content="${escapeHtml(imageAlt)}" />`
      : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/** Fetch the SPA shell and inject the given meta tags + (optional) title. */
async function injectMeta(
  request: Request,
  env: Env,
  options: MetaTagOptions & { pageTitle?: string },
): Promise<Response> {
  const response = await env.ASSETS.fetch(request)
  const rewriter = new HTMLRewriter().on(
    'head',
    new MetaTagInjector(buildMetaTags(options)),
  )
  if (options.pageTitle) {
    rewriter.on('title', new TitleRewriter(options.pageTitle))
  }
  return rewriter.transform(response)
}

/**
 * Serve a pre-rendered PNG asset, falling back to a rendered default.
 *
 * Also the last resort for every other OG route: a card whose own render failed
 * degrades to this rather than 500ing, so a name with an unrenderable avatar
 * still gets a usable preview instead of a broken image on every page.
 */
async function serveDefaultOgImage(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response> {
  const response = await env.ASSETS.fetch(
    new Request(`${url.origin}/assets/og/default.png`),
  )
  if (response.ok) {
    return new Response(response.body, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    })
  }

  return (
    (await renderDefaultOgImage(request.url, env)) ??
    new Response('OG image rendering failed', { status: 500 })
  )
}

const OG_ADDRESS_RE = /^addr\/(0x[0-9a-fA-F]{40})(?:\/(.+))?$/
const OG_RESOLVER_RE = /^resolver\/(0x[0-9a-fA-F]{40})(?:\/(.+))?$/
const OG_REGISTRY_RE = /^registry\/(0x[0-9a-fA-F]{40})(?:\/(.+))?$/
const OG_TLD_RE = /^tld\/(.+)$/

/**
 * Dispatch an `/og/...png` request to the matching OG renderer.
 *
 * Returns `null` when the chosen renderer couldn't produce an image, so the
 * caller can serve the default card instead of letting the failure surface.
 */
async function handleOgImage(
  decoded: string,
  request: Request,
  env: Env,
): Promise<Response | null> {
  const addrMatch = decoded.match(OG_ADDRESS_RE)
  if (addrMatch) {
    return renderAddressOgImage(
      addrMatch[1],
      request.url,
      env,
      addrMatch[2] ?? null,
    )
  }

  const resolverMatch = decoded.match(OG_RESOLVER_RE)
  if (resolverMatch) {
    const isPermissioned = await fetchIsPermissionedResolver(
      env,
      resolverMatch[1],
    )
    return renderResolverOgImage(
      resolverMatch[1],
      request.url,
      env,
      resolverMatch[2] ?? null,
      isPermissioned,
    )
  }

  const registryMatch = decoded.match(OG_REGISTRY_RE)
  if (registryMatch) {
    return renderRegistryOgImage(
      registryMatch[1],
      request.url,
      env,
      registryMatch[2] ?? null,
    )
  }

  const tldMatch = decoded.match(OG_TLD_RE)
  if (tldMatch) {
    return renderTldOgImage(tldMatch[1], request.url, env)
  }

  // Name OG image with optional subpage: /og/name/subpage.png
  const nameParts = decoded.split('/')
  const { avatar, owner } = await fetchEnsData(
    env,
    nameParts[0],
    new URL(request.url).host,
  )
  return renderOgImage(
    nameParts[0],
    avatar,
    owner,
    request.url,
    env,
    nameParts[1] ?? null,
  )
}

/** Inject meta tags for an `/addr/0x…` page. */
function handleAddressPage(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response> {
  const address = extractAddrFromPath(url.pathname)
  if (!address) return env.ASSETS.fetch(request)

  const decodedAddress = decodeURIComponent(address)
  const displayAddress = truncateAddress(decodedAddress, 6, 5)
  const segments = url.pathname.split('/')
  const subpage = segments.length > 3 ? segments.slice(3).join('/') : ''
  const encoded = encodeURIComponent(decodedAddress)
  const imageUrl = subpage
    ? `https://${url.host}/og/addr/${encoded}/${encodeURIComponent(subpage)}.png`
    : `https://${url.host}/og/addr/${encoded}.png`
  const pageTitle = subpage
    ? `${displayAddress} > ${subpage} — ENS Explorer App`
    : `${displayAddress} — ENS Explorer App`

  return injectMeta(request, env, {
    title: pageTitle,
    pageTitle,
    description: `Ethereum address ${decodedAddress}`,
    imageUrl,
    type: 'profile',
  })
}

/** Inject meta tags for a contract page (`/resolver/0x…` or `/registry/0x…`). */
function handleContractPage(
  request: Request,
  url: URL,
  env: Env,
  kind: 'resolver' | 'registry',
  address: string,
  subpage: string | null,
): Promise<Response> {
  const label = kind === 'resolver' ? 'Resolver' : 'Registry'
  const decodedAddress = decodeURIComponent(address)
  const displayAddress = truncateAddress(decodedAddress, 6, 5)
  const encoded = encodeURIComponent(decodedAddress)
  const imageUrl = subpage
    ? `https://${url.host}/og/${kind}/${encoded}/${encodeURIComponent(subpage)}.png`
    : `https://${url.host}/og/${kind}/${encoded}.png`
  const pageTitle = subpage
    ? `${label} ${displayAddress} > ${subpage} — ENS Explorer App`
    : `${label} ${displayAddress} — ENS Explorer App`

  return injectMeta(request, env, {
    title: pageTitle,
    pageTitle,
    description: `ENS ${label.toLowerCase()} ${decodedAddress}`,
    imageUrl,
  })
}

/** Inject meta tags for an ENS name page (including subpages). */
async function handleNamePage(
  request: Request,
  url: URL,
  env: Env,
  name: string,
): Promise<Response> {
  const decodedName = decodeURIComponent(name)
  const [response, ensData] = await Promise.all([
    env.ASSETS.fetch(request),
    fetchEnsData(env, decodedName, url.host),
  ])

  const { description, avatar } = ensData
  const segments = url.pathname.split('/')
  const subpage = segments.length > 2 ? segments.slice(2).join('/') : ''
  const encoded = encodeURIComponent(decodedName)
  const imageUrl = subpage
    ? `https://${url.host}/og/${encoded}/${encodeURIComponent(subpage)}.png`
    : `https://${url.host}/og/${encoded}.png`
  const subpageTitle = segments.length > 2 ? segments.slice(2).join(' > ') : ''
  const pageTitle = subpageTitle
    ? `${decodedName} > ${subpageTitle} — ENS Explorer App`
    : `${decodedName} — ENS Explorer App`

  return new HTMLRewriter()
    .on(
      'head',
      new MetaTagInjector(
        buildMetaTags({
          title: pageTitle,
          description: description ?? `ENS profile for ${decodedName}`,
          imageUrl,
          type: 'profile',
          imageAlt: avatar ? `${decodedName} avatar` : null,
        }),
      ),
    )
    .on('title', new TitleRewriter(pageTitle))
    .transform(response)
}

/** Inject meta tags for a `/tld/…` page. */
function handleTldPage(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response> {
  const tld = extractTldFromPath(url.pathname)
  if (!tld) return env.ASSETS.fetch(request)

  const decodedTld = decodeURIComponent(tld)
  const pageTitle = `${decodedTld} — ENS Explorer App`

  return injectMeta(request, env, {
    title: pageTitle,
    pageTitle,
    description: `ENS Top Level Domain ${decodedTld}`,
    imageUrl: `https://${url.host}/og/tld/${encodeURIComponent(decodedTld)}.png`,
  })
}

/**
 * Inject OG / meta tags for the SPA page matching `pathname`.
 *
 * Routes are matched most-specific first: address, then contract (resolver /
 * registry), then ENS name, then TLD, finally the default card. Contract and
 * name handling are deliberately ordered so reserved route segments
 * (`resolver`, `registry`) never fall through to the name handler (WEB-509).
 */
function handlePageMeta(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response> {
  const { pathname } = url

  if (isAddressRoute(pathname) || isAddrSubpage(pathname)) {
    return handleAddressPage(request, url, env)
  }

  const resolverRoute = matchContractRoute(pathname, 'resolver')
  if (resolverRoute) {
    return handleContractPage(
      request,
      url,
      env,
      'resolver',
      resolverRoute.address,
      resolverRoute.subpage,
    )
  }

  const registryRoute = matchContractRoute(pathname, 'registry')
  if (registryRoute) {
    return handleContractPage(
      request,
      url,
      env,
      'registry',
      registryRoute.address,
      registryRoute.subpage,
    )
  }

  const name = extractNameFromPath(pathname)
  if (name) {
    return handleNamePage(request, url, env, name)
  }

  // `/register?name=foo.eth` previews the registration target name, which lives
  // in the query string rather than the path (WEB-509 reserved `/register`).
  const registerName = extractRegisterName(pathname, url.searchParams)
  if (registerName) {
    return handleNamePage(request, url, env, registerName)
  }

  if (isTldRoute(pathname)) {
    return handleTldPage(request, url, env)
  }

  // All other routes: inject default OG meta tags.
  return injectMeta(request, env, {
    title: 'ENS Explorer App',
    description: 'Explore ENS names and addresses',
    imageUrl: `https://${url.host}/og/default.png`,
  })
}

async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const { pathname } = url

  // Default OG image route: /og/default.png
  if (pathname === '/og/default.png') {
    return serveDefaultOgImage(request, url, env)
  }

  // OG image route: /og/:name.png or /og/:name/:subpage.png
  const ogMatch = pathname.match(/^\/og\/(.+)\.png$/)
  if (ogMatch) {
    const rendered = await handleOgImage(
      decodeURIComponent(ogMatch[1]),
      request,
      env,
    )
    return rendered ?? serveDefaultOgImage(request, url, env)
  }

  // Page routes: only inject meta tags for HTML navigations, never assets.
  if (!wantsHtml(request)) {
    return env.ASSETS.fetch(request)
  }
  return handlePageMeta(request, url, env)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return withSecurityHeaders(await handle(request, env))
  },
}
