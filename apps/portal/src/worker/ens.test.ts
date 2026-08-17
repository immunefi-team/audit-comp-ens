import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockResolveEnsOwner = vi.fn()

vi.mock('@ensdomains/ensjs/public', () => ({
  getRecords: vi.fn(),
}))

vi.mock('@/utils/ens/resolveEnsOwner', () => ({
  resolveEnsOwner: (...args: unknown[]) => mockResolveEnsOwner(...args),
}))

const { resolveOwner, resolveAvatarDataUri } = await import('./ens')

const OWNER = '0x1111111111111111111111111111111111111111'
const client = {} as never

/** Build a Response whose body streams the given bytes in fixed-size chunks. */
function streamingResponse(
  bytes: Uint8Array,
  { contentType = 'image/png', chunkSize = 64 } = {},
): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.byteLength; i += chunkSize) {
        controller.enqueue(bytes.subarray(i, i + chunkSize))
      }
      controller.close()
    },
  })
  return new Response(body, { headers: { 'content-type': contentType } })
}

/** A 302 pointing at `location`, as returned under `redirect: 'manual'`. */
function redirectResponse(location: string): Response {
  return new Response(null, { status: 302, headers: { location } })
}

describe('resolveOwner (worker)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns just the owner address from the shared resolver', async () => {
    mockResolveEnsOwner.mockResolvedValueOnce({
      owner: OWNER,
      registryAddress: '0x00000000000000000000000000000000000ce610',
      protocolVersion: 'ENSv2',
    })

    const owner = await resolveOwner(client, 'alice.ledgit.eth')

    expect(owner).toBe(OWNER)
    expect(mockResolveEnsOwner).toHaveBeenCalledWith(client, 'alice.ledgit.eth')
  })

  it('returns null when the name is unowned (renders as "available")', async () => {
    mockResolveEnsOwner.mockResolvedValueOnce(null)

    const owner = await resolveOwner(client, 'unclaimed.eth')

    expect(owner).toBeNull()
  })

  it('returns null when the shared resolver throws', async () => {
    mockResolveEnsOwner.mockRejectedValueOnce(new Error('rpc down'))

    const owner = await resolveOwner(client, 'ledgit.eth')

    expect(owner).toBeNull()
  })
})

describe('resolveAvatarDataUri (worker)', () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    fetchSpy.mockReset()
  })

  it('embeds a fetched image as a base64 data URI', async () => {
    fetchSpy.mockResolvedValueOnce(
      streamingResponse(new Uint8Array([1, 2, 3, 4]), {
        contentType: 'image/png',
      }),
    )

    const result = await resolveAvatarDataUri(
      client,
      'https://cdn.example/cat.png',
    )

    expect(result).toBe(`data:image/png;base64,${btoa('\x01\x02\x03\x04')}`)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('does not HEAD the upstream before the GET', async () => {
    // viem's parseAvatarRecord sniffed Content-Type with a prior HEAD, hitting
    // an attacker-chosen endpoint twice (WEB-672). We resolve it ourselves now.
    fetchSpy.mockResolvedValueOnce(
      streamingResponse(new Uint8Array([1]), { contentType: 'image/png' }),
    )

    await resolveAvatarDataUri(client, 'https://cdn.example/cat.png')

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0]?.[1]?.method).toBeUndefined()
  })

  it('passes inline data: URIs through without fetching', async () => {
    const inline = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='

    const result = await resolveAvatarDataUri(client, inline)

    expect(result).toBe(inline)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('inlines a raw on-chain SVG without fetching', async () => {
    const result = await resolveAvatarDataUri(client, '<svg></svg>')

    expect(result).toBe(`data:image/svg+xml;base64,${btoa('<svg></svg>')}`)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects inline data: URIs with a non-image MIME type without fetching', async () => {
    const result = await resolveAvatarDataUri(
      client,
      'data:text/html;base64,PHNjcmlwdD4=',
    )

    expect(result).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects non-image content types', async () => {
    fetchSpy.mockResolvedValueOnce(
      streamingResponse(new Uint8Array([0]), { contentType: 'text/html' }),
    )

    const result = await resolveAvatarDataUri(
      client,
      'https://evil.example/page',
    )

    expect(result).toBeNull()
  })

  it('accepts an image Content-Type that carries parameters', async () => {
    fetchSpy.mockResolvedValueOnce(
      streamingResponse(new Uint8Array([1]), {
        contentType: 'image/svg+xml; charset=utf-8',
      }),
    )

    const result = await resolveAvatarDataUri(
      client,
      'https://cdn.example/cat.svg',
    )

    expect(result).toBe(`data:image/svg+xml;base64,${btoa('\x01')}`)
  })

  it('rejects upstream responses that omit Content-Type entirely', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]))
        controller.close()
      },
    })
    fetchSpy.mockResolvedValueOnce(new Response(body))

    const result = await resolveAvatarDataUri(
      client,
      'https://cdn.example/no-ct',
    )

    expect(result).toBeNull()
  })

  it('rejects payloads larger than the 5MB cap', async () => {
    const tooBig = new Uint8Array(5 * 1024 * 1024 + 1)
    fetchSpy.mockResolvedValueOnce(
      streamingResponse(tooBig, {
        contentType: 'image/png',
        chunkSize: 64 * 1024,
      }),
    )

    const result = await resolveAvatarDataUri(
      client,
      'https://evil.example/huge.png',
    )

    expect(result).toBeNull()
  })

  it('cancels the upstream once the cap is exceeded, rather than draining it', async () => {
    // Cancellation is implicit now — returning from `for await` calls the
    // iterator's return(), which cancels the stream. Pin it: an endless body
    // would otherwise be read forever instead of disconnected at the cap.
    let cancelled = false
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(64 * 1024))
      },
      cancel() {
        cancelled = true
      },
    })
    fetchSpy.mockResolvedValueOnce(
      new Response(endless, { headers: { 'content-type': 'image/png' } }),
    )

    const result = await resolveAvatarDataUri(
      client,
      'https://evil.example/endless.png',
    )

    expect(result).toBeNull()
    expect(cancelled).toBe(true)
  })

  it('passes an abort signal (timeout) to fetch', async () => {
    fetchSpy.mockResolvedValueOnce(
      streamingResponse(new Uint8Array([1]), { contentType: 'image/png' }),
    )

    await resolveAvatarDataUri(client, 'https://cdn.example/cat.png')

    const init = fetchSpy.mock.calls[0]?.[1]
    expect(init?.signal).toBeInstanceOf(AbortSignal)
  })

  it('returns null when the upstream responds with a non-ok status', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 502 }))

    const result = await resolveAvatarDataUri(
      client,
      'https://cdn.example/cat.png',
    )

    expect(result).toBeNull()
  })

  it('returns null when fetch throws (e.g. timeout/abort)', async () => {
    fetchSpy.mockRejectedValueOnce(new DOMException('aborted', 'AbortError'))

    const result = await resolveAvatarDataUri(
      client,
      'https://slow.example/cat.png',
    )

    expect(result).toBeNull()
  })

  it('returns null when the record is unresolvable', async () => {
    const result = await resolveAvatarDataUri(client, 'not-a-uri')

    expect(result).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  describe('SSRF guards (WEB-672)', () => {
    it('rejects http: records without fetching', async () => {
      // Parity with the `img-src … https:` CSP — http avatars don't render
      // in-app either, so this removes nothing that currently works.
      const result = await resolveAvatarDataUri(
        client,
        'http://cdn.example/cat.png',
      )

      expect(result).toBeNull()
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    // Every IP literal is rejected, not just reserved ranges — a hostname is
    // required. Reserved addresses are listed explicitly anyway, since those
    // are the ones with security consequences if the rule ever loosens.
    it.each([
      ['loopback', 'https://127.0.0.1/a.png'],
      ['loopback, decimal-encoded', 'https://2130706433/a.png'],
      ['loopback, hex-encoded', 'https://0x7f.1/a.png'],
      ['loopback, octal-encoded', 'https://017700000001/a.png'],
      ['loopback, shorthand', 'https://127.1/a.png'],
      ['RFC1918 10/8', 'https://10.0.0.5/a.png'],
      ['RFC1918 172.16/12', 'https://172.20.1.1/a.png'],
      ['RFC1918 192.168/16', 'https://192.168.1.1/a.png'],
      ['link-local metadata', 'https://169.254.169.254/latest/meta-data/'],
      ['CGNAT 100.64/10', 'https://100.64.0.1/a.png'],
      ['benchmarking 198.18/15', 'https://198.18.0.1/a.png'],
      ['multicast', 'https://224.0.0.1/a.png'],
      ['broadcast', 'https://255.255.255.255/a.png'],
      ['unspecified', 'https://0.0.0.0/a.png'],
      ['IPv6 loopback', 'https://[::1]/a.png'],
      ['IPv4-mapped IPv6 loopback', 'https://[::ffff:127.0.0.1]/a.png'],
      ['IPv6 link-local', 'https://[fe80::1]/a.png'],
      ['IPv6 ULA', 'https://[fd00::1]/a.png'],
      // Public literals too: an avatar URL is something a human pasted, and
      // those name a host. Blocking the whole class beats tracking ranges.
      ['a public IPv4 literal', 'https://93.184.216.34/a.png'],
      ['a public IPv6 literal', 'https://[2606:4700::1]/a.png'],
      ['a public IPv4 literal with a valid IP cert', 'https://1.1.1.1/a.png'],
    ])('rejects %s without fetching', async (_label, record) => {
      const result = await resolveAvatarDataUri(client, record)

      expect(result).toBeNull()
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it.each([
      ['a normal hostname', 'https://cdn.example/a.png'],
      ['a subdomain', 'https://images.cdn.example/a.png'],
      // Hostnames that merely *look* numeric must not trip the IPv4 check —
      // over-blocking would break the self-hosted avatars this design exists
      // to support.
      ['an all-numeric hostname', 'https://123456.example/a.png'],
      ['a hostname with numeric labels', 'https://1.2.3.example/a.png'],
    ])('still allows %s', async (_label, record) => {
      // The guard must not overreach: self-hosted avatars are the reason we
      // can't just use an allowlist, so false positives are a real regression.
      fetchSpy.mockResolvedValueOnce(
        streamingResponse(new Uint8Array([1]), { contentType: 'image/png' }),
      )

      const result = await resolveAvatarDataUri(client, record)

      expect(result).toBe(`data:image/png;base64,${btoa('\x01')}`)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    it('rejects URLs carrying credentials without fetching', async () => {
      const result = await resolveAvatarDataUri(
        client,
        'https://user:pass@cdn.example/cat.png',
      )

      expect(result).toBeNull()
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('rejects the worker’s own host, preventing /og self-recursion', async () => {
      const result = await resolveAvatarDataUri(
        client,
        'https://portal.example/og/victim.eth.png',
        'portal.example',
      )

      expect(result).toBeNull()
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('follows a redirect to an allowed host', async () => {
      fetchSpy
        .mockResolvedValueOnce(redirectResponse('https://cdn2.example/cat.png'))
        .mockResolvedValueOnce(
          streamingResponse(new Uint8Array([7]), { contentType: 'image/png' }),
        )

      const result = await resolveAvatarDataUri(
        client,
        'https://cdn.example/cat.png',
      )

      expect(result).toBe(`data:image/png;base64,${btoa('\x07')}`)
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })

    it('re-validates each hop, blocking a redirect into private space', async () => {
      // The whole point of redirect: 'manual' — a benign-looking initial URL
      // 302ing to an internal address must not be followed.
      fetchSpy.mockResolvedValueOnce(
        redirectResponse('https://169.254.169.254/latest/meta-data/'),
      )

      const result = await resolveAvatarDataUri(
        client,
        'https://cdn.example/cat.png',
      )

      expect(result).toBeNull()
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    it('blocks a redirect that downgrades to http:', async () => {
      fetchSpy.mockResolvedValueOnce(
        redirectResponse('http://cdn.example/cat.png'),
      )

      const result = await resolveAvatarDataUri(
        client,
        'https://cdn.example/cat.png',
      )

      expect(result).toBeNull()
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    it('gives up on a redirect loop instead of following it forever', async () => {
      fetchSpy.mockResolvedValue(
        redirectResponse('https://cdn.example/cat.png'),
      )

      const result = await resolveAvatarDataUri(
        client,
        'https://cdn.example/cat.png',
      )

      expect(result).toBeNull()
      // Initial hop + MAX_REDIRECTS (3).
      expect(fetchSpy).toHaveBeenCalledTimes(4)
    })

    it('resolves a relative Location against the current hop', async () => {
      fetchSpy
        .mockResolvedValueOnce(redirectResponse('/moved/cat.png'))
        .mockResolvedValueOnce(
          streamingResponse(new Uint8Array([9]), { contentType: 'image/png' }),
        )

      const result = await resolveAvatarDataUri(
        client,
        'https://cdn.example/cat.png',
      )

      expect(result).toBe(`data:image/png;base64,${btoa('\x09')}`)
      expect(fetchSpy.mock.calls[1]?.[0]).toBe(
        'https://cdn.example/moved/cat.png',
      )
    })

    it('rejects a redirect with no Location header', async () => {
      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 302 }))

      const result = await resolveAvatarDataUri(
        client,
        'https://cdn.example/cat.png',
      )

      expect(result).toBeNull()
    })
  })
})
