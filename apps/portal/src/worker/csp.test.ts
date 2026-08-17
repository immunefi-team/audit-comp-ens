import { SEPOLIA_FALLBACK_RPC_URLS } from '@ens-apps/indexer/chain'
import { describe, expect, it } from 'vitest'
import {
  cspMetaTag,
  cspWithFrameAncestors,
  cspWithoutFrameAncestors,
  originFromEnvUrl,
  withSecurityHeaders,
} from './csp'

/** Parse a policy string into a `{ directive: tokens[] }` map. */
function parseDirectives(policy: string): Record<string, string[]> {
  return Object.fromEntries(
    policy
      .split(';')
      .map((directive) => directive.trim())
      .filter(Boolean)
      .map((directive) => {
        const [name, ...values] = directive.split(/\s+/)
        return [name, values]
      }),
  )
}

const header = parseDirectives(cspWithFrameAncestors)
const meta = parseDirectives(cspWithoutFrameAncestors)

describe('csp', () => {
  // The invariants below must never silently regress — each one would either
  // open an XSS/clickjacking hole or break a flow in the browser (not here).
  describe('security invariants', () => {
    it('locks the baseline fetch directives to self', () => {
      expect(header['default-src']).toEqual(["'self'"])
      expect(header['object-src']).toEqual(["'none'"])
      expect(header['base-uri']).toEqual(["'self'"])
      expect(header['form-action']).toEqual(["'self'"])
    })

    it('never allows unsafe script execution', () => {
      // 'wasm-unsafe-eval' (WASM compile only) is allowed; general 'unsafe-eval'
      // and 'unsafe-inline' must never appear in script-src.
      expect(header['script-src']).toContain("'wasm-unsafe-eval'")
      expect(header['script-src']).not.toContain("'unsafe-inline'")
      expect(header['script-src']).not.toContain("'unsafe-eval'")
    })

    it('forbids framing via both frame-ancestors and X-Frame-Options', () => {
      // The two must agree: 'none' ⇔ DENY. A mismatch is a real footgun.
      expect(header['frame-ancestors']).toEqual(["'none'"])
      expect(
        withSecurityHeaders(new Response('hi')).headers.get('X-Frame-Options'),
      ).toBe('DENY')
    })
  })

  // connect-src is a long allowlist; enumerating every host just mirrors the
  // source. These tests instead pin the *decisions* encoded in that list.
  describe('connect-src wildcard collapse', () => {
    const connectSrc = header['connect-src'] ?? []

    it("starts from 'self'", () => {
      expect(connectSrc).toContain("'self'")
    })

    it('allowlists every shared RPC failover origin', () => {
      // The viem transports (lib/wagmi.ts, worker/clients.ts) fail over to
      // SEPOLIA_FALLBACK_RPC_URLS; a fallback origin missing here means the
      // browser blocks the request and the failover silently does nothing in
      // production. Derived from the same export so the two can't drift.
      for (const url of SEPOLIA_FALLBACK_RPC_URLS) {
        expect(connectSrc).toContain(new URL(url).origin)
      }
      // The keyed dRPC primary stays allowlisted alongside the fallbacks.
      expect(connectSrc).toContain('https://lb.drpc.live')
    })

    it('collapses ENS hosts into wildcards rather than listing them bare', () => {
      // The wildcard is the single source of truth — a bare host alongside it
      // means someone re-added a redundant (and easily-stale) entry.
      expect(connectSrc).toContain('https://*.ens.dev')
      expect(connectSrc).not.toContain('https://graphql.ens.dev')
      expect(connectSrc).not.toContain('https://app-api.ens.dev')

      expect(connectSrc).toContain('https://*.ens.domains')
      expect(connectSrc).not.toContain('https://jakob.ens.domains')
    })

    it('keeps image-only hosts out of connect-src', () => {
      // Avatars/images load via <img> (covered by img-src), so image CDNs must
      // never leak into connect-src (regression guard for i.pinimg.com).
      expect(connectSrc).not.toContain('https://i.pinimg.com')
    })

    it('allowlists the CCIP-read gateway fan-out as wildcards', () => {
      // viem resolves the UniversalResolver's batch gateway locally
      // (x-batch-gateway:true) and fetches the per-chain verifier gateways
      // straight from the browser. Both domain families are
      // subdomain-per-deployment (ccip-v3.ens.xyz, arbitrum-sepolia.3668.io,
      // …), so the wildcard is the source of truth — a bare host alongside it
      // is a redundant, easily-stale entry.
      expect(connectSrc).toContain('https://*.ens.xyz')
      expect(connectSrc).not.toContain('https://ccip-v3.ens.xyz')
      expect(connectSrc).toContain('https://*.3668.io')
      expect(connectSrc).not.toContain('https://linea-sepolia.3668.io')
      // Unruggable's drpc-load-balanced gateway host — not the RPC (.live).
      expect(connectSrc).toContain('https://lb.drpc.org')
    })
  })

  // img-src and script-src each encode a deliberate, non-obvious choice.
  describe('host-handling choices', () => {
    it('keeps image loading host-agnostic over https only', () => {
      // An ENS avatar record is an arbitrary user-supplied URL, so images are
      // never host-checked. http: is omitted on purpose — upgrade-insecure-
      // requests rewrites it to https: and browsers block mixed content anyway,
      // so a plaintext http: image can never load.
      expect(header['img-src']).toEqual(["'self'", 'data:', 'blob:', 'https:'])
    })

    it('pins the inline theme-init hash instead of unsafe-inline', () => {
      // Hardcoded sha256 hash lets the one inline script (theme-init in
      // index.html) run without 'unsafe-inline'.
      expect(header['script-src']).toContain(
        "'sha256-dvxYa7VmoGYAPR03Kp8okAGePv+XjpmficO2jq/Ia9g='",
      )
    })

    it('allowlists no third-party script hosts', () => {
      // PostHog is pre-bundled (module.full.no-external) and served from 'self',
      // so it no longer loads scripts from the analytics host. script-src must
      // not regress to allowing an external script origin.
      expect(header['script-src']).toEqual([
        "'self'",
        "'wasm-unsafe-eval'",
        "'sha256-dvxYa7VmoGYAPR03Kp8okAGePv+XjpmficO2jq/Ia9g='",
      ])
      expect(header['script-src']).not.toContain('https://jakob.ens.domains')
    })
  })

  // The header and <meta> variants are built from the same base but diverge on
  // directives the browser rejects inside a <meta> tag. This is real branching.
  describe('header vs. meta split', () => {
    it('emits header-only directives only in the header', () => {
      // frame-ancestors is invalid in <meta>; report-* only fire from the header.
      expect(header['frame-ancestors']).toEqual(["'none'"])
      expect(meta['frame-ancestors']).toBeUndefined()

      expect(header['report-to']).toEqual(['posthog'])
      expect(header['report-uri']?.[0]).toContain(
        'https://eu.i.posthog.com/report/',
      )
      expect(meta['report-to']).toBeUndefined()
      expect(meta['report-uri']).toBeUndefined()
    })

    it('keeps upgrade-insecure-requests in both (valid in a meta tag)', () => {
      expect(header).toHaveProperty('upgrade-insecure-requests')
      expect(meta).toHaveProperty('upgrade-insecure-requests')
    })

    it('wraps the meta policy in a meta tag without frame-ancestors', () => {
      expect(cspMetaTag).toContain('http-equiv="Content-Security-Policy"')
      expect(cspMetaTag).toContain(cspWithoutFrameAncestors)
      expect(cspMetaTag).not.toContain('frame-ancestors')
    })
  })

  describe('originFromEnvUrl', () => {
    it('extracts the origin from an absolute URL, dropping path/query', () => {
      // RPC override carries an API key in the path; only the origin is allowed.
      expect(
        originFromEnvUrl('https://rpc.example.com/sepolia/secret-key?x=1'),
      ).toBe('https://rpc.example.com')
    })

    it('keeps a non-default port in the origin', () => {
      expect(originFromEnvUrl('http://127.0.0.1:5655/graphql')).toBe(
        'http://127.0.0.1:5655',
      )
    })

    it('returns null for unset, relative, or non-http(s) values', () => {
      // Relative paths resolve to the page origin (already covered by 'self').
      expect(originFromEnvUrl(undefined)).toBeNull()
      expect(originFromEnvUrl('')).toBeNull()
      expect(originFromEnvUrl('/rpc')).toBeNull()
      expect(originFromEnvUrl('ws://relay.example.com')).toBeNull()
      expect(originFromEnvUrl('not a url')).toBeNull()
    })
  })

  describe('withSecurityHeaders', () => {
    it('sets the CSP and standard security headers', () => {
      const result = withSecurityHeaders(new Response('hi'))

      expect(result.headers.get('Content-Security-Policy')).toBe(
        cspWithFrameAncestors,
      )
      expect(result.headers.get('Reporting-Endpoints')).toMatch(
        /^posthog="https:\/\/eu\.i\.posthog\.com\/report\//,
      )
      expect(result.headers.get('X-Content-Type-Options')).toBe('nosniff')
      expect(result.headers.get('Referrer-Policy')).toBe(
        'strict-origin-when-cross-origin',
      )
      expect(result.headers.get('Permissions-Policy')).toBe(
        'geolocation=(), microphone=(), camera=()',
      )
    })

    it('preserves the original response body and status', async () => {
      // Guards the immutable-headers rewrap (env.ASSETS.fetch responses).
      const result = withSecurityHeaders(
        new Response('body', { status: 201, statusText: 'Created' }),
      )
      expect(result.status).toBe(201)
      expect(await result.text()).toBe('body')
    })
  })
})
