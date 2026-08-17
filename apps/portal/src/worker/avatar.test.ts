import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockReadContract = vi.fn()

vi.mock('viem/actions', () => ({
  readContract: (...args: unknown[]) => mockReadContract(...args),
}))

const { resolveAvatarRecord } = await import('./avatar')

const client = {} as never
const NFT = '0x1111111111111111111111111111111111111111'

const utf8Encoder = new TextEncoder()

/** A JSON response as an IPFS gateway or metadata host would return it. */
function jsonResponse(
  value: unknown,
  { contentType = 'application/json' } = {},
): Response {
  const bytes = utf8Encoder.encode(JSON.stringify(value))
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
  return new Response(body, { headers: { 'content-type': contentType } })
}

describe('resolveAvatarRecord', () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    fetchSpy.mockReset()
  })

  describe('plain records', () => {
    it('passes an https record through untouched', async () => {
      const result = await resolveAvatarRecord(
        client,
        'https://cdn.example/cat.png',
      )

      expect(result).toEqual({
        kind: 'remote',
        url: 'https://cdn.example/cat.png',
      })
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('rewrites ipfs:// onto the configured gateway', async () => {
      const cid = 'QmSP4nq9fnN9dAiCj42ug9Wa79rqmQerZXZch82VqpiH7U'

      const result = await resolveAvatarRecord(client, `ipfs://${cid}`)

      expect(result).toEqual({
        kind: 'remote',
        url: `https://ipfs.euc.li/ipfs/${cid}`,
      })
    })

    it('inlines an on-chain data: URI', async () => {
      const inline = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='

      const result = await resolveAvatarRecord(client, inline)

      expect(result).toEqual({ kind: 'inline', uri: inline })
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('throws on an unresolvable record', async () => {
      await expect(resolveAvatarRecord(client, 'nonsense')).rejects.toThrow()
    })
  })

  describe('eip155 NFT records', () => {
    it('reads tokenURI, fetches metadata, and resolves the image', async () => {
      mockReadContract.mockResolvedValueOnce('https://meta.example/1.json')
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ image: 'https://img.example/1.png' }),
      )

      const result = await resolveAvatarRecord(
        client,
        `eip155:1/erc721:${NFT}/1`,
      )

      expect(result).toEqual({
        kind: 'remote',
        url: 'https://img.example/1.png',
      })
      expect(mockReadContract).toHaveBeenCalledWith(
        client,
        expect.objectContaining({ functionName: 'tokenURI', args: [1n] }),
      )
    })

    it('accepts metadata served as text/plain (common on IPFS gateways)', async () => {
      mockReadContract.mockResolvedValueOnce('https://meta.example/1.json')
      fetchSpy.mockResolvedValueOnce(
        jsonResponse(
          { image: 'https://img.example/1.png' },
          { contentType: 'text/plain; charset=utf-8' },
        ),
      )

      const result = await resolveAvatarRecord(
        client,
        `eip155:1/erc721:${NFT}/1`,
      )

      expect(result).toEqual({
        kind: 'remote',
        url: 'https://img.example/1.png',
      })
    })

    it('substitutes and zero-pads {id} for erc1155', async () => {
      mockReadContract.mockResolvedValueOnce('https://meta.example/{id}.json')
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ image: 'https://img.example/1.png' }),
      )

      await resolveAvatarRecord(client, `eip155:1/erc1155:${NFT}/1`)

      expect(fetchSpy.mock.calls[0]?.[0]).toBe(
        `https://meta.example/${'1'.padStart(64, '0')}.json`,
      )
    })

    it('decodes base64 on-chain metadata without any fetch', async () => {
      const metadata = btoa(
        JSON.stringify({ image: 'https://img.example/x.png' }),
      )
      mockReadContract.mockResolvedValueOnce(
        `data:application/json;base64,${metadata}`,
      )

      const result = await resolveAvatarRecord(
        client,
        `eip155:1/erc721:${NFT}/1`,
      )

      expect(result).toEqual({
        kind: 'remote',
        url: 'https://img.example/x.png',
      })
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('rejects an unsupported namespace', async () => {
      await expect(
        resolveAvatarRecord(client, `eip155:1/erc20:${NFT}/1`),
      ).rejects.toThrow(/unsupported NFT namespace/)
    })

    describe('metadata fetch is guarded (WEB-672)', () => {
      // viem's getMetadataAvatarUri did `fetch(uri).then(r => r.json())` with no
      // timeout, size cap or Content-Type check. These cover the replacement.

      it('sends the metadata request with manual redirect handling', async () => {
        mockReadContract.mockResolvedValueOnce('https://meta.example/1.json')
        fetchSpy.mockResolvedValueOnce(
          jsonResponse({ image: 'https://img.example/1.png' }),
        )

        await resolveAvatarRecord(client, `eip155:1/erc721:${NFT}/1`)

        const init = fetchSpy.mock.calls[0]?.[1]
        expect(init?.redirect).toBe('manual')
        expect(init?.signal).toBeInstanceOf(AbortSignal)
      })

      it('rejects a tokenURI pointing into private address space', async () => {
        mockReadContract.mockResolvedValueOnce(
          'https://169.254.169.254/latest/meta-data/',
        )

        await expect(
          resolveAvatarRecord(client, `eip155:1/erc721:${NFT}/1`),
        ).rejects.toThrow(/metadata fetch rejected/)
        expect(fetchSpy).not.toHaveBeenCalled()
      })

      it('rejects an http: tokenURI', async () => {
        mockReadContract.mockResolvedValueOnce('http://meta.example/1.json')

        await expect(
          resolveAvatarRecord(client, `eip155:1/erc721:${NFT}/1`),
        ).rejects.toThrow(/metadata fetch rejected/)
        expect(fetchSpy).not.toHaveBeenCalled()
      })

      it('rejects metadata with an unacceptable Content-Type', async () => {
        mockReadContract.mockResolvedValueOnce('https://meta.example/1.json')
        fetchSpy.mockResolvedValueOnce(
          jsonResponse(
            { image: 'https://img.example/1.png' },
            { contentType: 'text/html' },
          ),
        )

        await expect(
          resolveAvatarRecord(client, `eip155:1/erc721:${NFT}/1`),
        ).rejects.toThrow(/metadata fetch rejected/)
      })

      it('caps oversized metadata instead of parsing it', async () => {
        mockReadContract.mockResolvedValueOnce('https://meta.example/1.json')
        const tooBig = new Uint8Array(256 * 1024 + 1)
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            for (let i = 0; i < tooBig.byteLength; i += 64 * 1024) {
              controller.enqueue(tooBig.subarray(i, i + 64 * 1024))
            }
            controller.close()
          },
        })
        fetchSpy.mockResolvedValueOnce(
          new Response(body, {
            headers: { 'content-type': 'application/json' },
          }),
        )

        await expect(
          resolveAvatarRecord(client, `eip155:1/erc721:${NFT}/1`),
        ).rejects.toThrow(/metadata fetch rejected/)
      })

      it('re-validates redirects on the metadata hop', async () => {
        mockReadContract.mockResolvedValueOnce('https://meta.example/1.json')
        fetchSpy.mockResolvedValueOnce(
          new Response(null, {
            status: 302,
            headers: { location: 'https://10.0.0.5/internal.json' },
          }),
        )

        await expect(
          resolveAvatarRecord(client, `eip155:1/erc721:${NFT}/1`),
        ).rejects.toThrow(/metadata fetch rejected/)
        expect(fetchSpy).toHaveBeenCalledTimes(1)
      })
    })
  })
})
