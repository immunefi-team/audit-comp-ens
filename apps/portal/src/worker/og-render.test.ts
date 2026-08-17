import { beforeEach, describe, expect, it, vi } from 'vitest'

// og-render imports workers-og, which loads a WASM module at import time that
// the node test environment can't resolve. Stub it, recording the HTML each
// render was handed and letting a test decide how that render behaves — that
// hook is what drives the degradation paths below.
const og = vi.hoisted(() => ({
  htmls: [] as string[],
  render: (_html: string): ArrayBuffer => new ArrayBuffer(8),
}))

vi.mock('workers-og', () => ({
  ImageResponse: class {
    readonly html: string
    constructor(html: string) {
      this.html = html
      og.htmls.push(html)
    }
    arrayBuffer(): Promise<ArrayBuffer> {
      return Promise.resolve(og.render(this.html))
    }
  },
}))

const {
  escapeHtml,
  resolverSubtitle,
  resolverPageLabel,
  registryPageLabel,
  renderOgImage,
} = await import('./og-render')

describe('escapeHtml', () => {
  it('escapes the five HTML-sensitive characters', () => {
    expect(escapeHtml('&')).toBe('&amp;')
    expect(escapeHtml('<')).toBe('&lt;')
    expect(escapeHtml('>')).toBe('&gt;')
    expect(escapeHtml('"')).toBe('&quot;')
    expect(escapeHtml("'")).toBe('&#39;')
  })

  it('neutralizes a single-quote attribute breakout', () => {
    expect(escapeHtml("vitalik' onerror='alert(1)")).toBe(
      'vitalik&#39; onerror=&#39;alert(1)',
    )
  })

  it('does not double-escape ampersands in its own output', () => {
    // a combined input confirms neither replacement double-escapes the
    // other's output — notably the & inside the &#39; emitted for '
    expect(escapeHtml("a&'b")).toBe('a&amp;&#39;b')
  })

  it('leaves slashes untouched so base64 data: URIs survive intact', () => {
    const url = 'data:image/png;base64,iVBOR/w0KGgo+AAAA=='
    expect(escapeHtml(url)).toBe(url)
  })
})

describe('resolverSubtitle', () => {
  it('labels permissioned resolvers', () => {
    expect(resolverSubtitle(true)).toBe('Permissioned Resolver')
  })

  it('labels plain resolvers', () => {
    expect(resolverSubtitle(false)).toBe('Resolver')
  })
})

describe('resolverPageLabel', () => {
  it('defaults to the overview label', () => {
    expect(resolverPageLabel(null)).toBe('Resolver Overview')
  })

  it('maps known subpages', () => {
    expect(resolverPageLabel('roles')).toBe('Roles')
    expect(resolverPageLabel('nodes')).toBe('Nodes')
    expect(resolverPageLabel('aliases')).toBe('Aliases')
    expect(resolverPageLabel('create-alias')).toBe('Create Alias')
    expect(resolverPageLabel('history')).toBe('History')
  })

  it('title-cases unknown subpages', () => {
    expect(resolverPageLabel('something')).toBe('Something')
  })
})

describe('registryPageLabel', () => {
  it('defaults to the overview label', () => {
    expect(registryPageLabel(null)).toBe('Registry Overview')
  })

  it('maps known subpages', () => {
    expect(registryPageLabel('labels')).toBe('Labels')
    expect(registryPageLabel('roles')).toBe('Roles')
    expect(registryPageLabel('history')).toBe('History')
  })
})

describe('renderOgImage', () => {
  // Fonts are irrelevant here: a 404 leaves the font list empty, which is
  // already the production behaviour when an asset lookup misses.
  const env = {
    ASSETS: { fetch: async () => new Response(null, { status: 404 }) },
  } as unknown as Env

  const AVATAR = 'data:image/jpeg;base64,AAAA'
  const OWNER = '0x1234567890123456789012345678901234567890'
  const URL_ = 'https://example.com/og/snowman.eth.png'

  const renderName = () =>
    renderOgImage('snowman.eth', AVATAR, OWNER, URL_, env)

  beforeEach(() => {
    og.htmls = []
    og.render = () => new ArrayBuffer(8)
  })

  it('renders a PNG when the avatar renders', async () => {
    const res = await renderName()

    expect(res?.status).toBe(200)
    expect(res?.headers.get('Content-Type')).toBe('image/png')
    expect(og.htmls).toHaveLength(1)
    expect(og.htmls[0]).toContain(AVATAR)
  })

  it('retries without the avatar when rendering it throws', async () => {
    // An avatar is the one element of the card sized by someone else, so it is
    // the part a render realistically dies on — see renderOgResponse.
    og.render = (html) => {
      if (html.includes(AVATAR)) throw new Error('Out of memory')
      return new ArrayBuffer(8)
    }

    const res = await renderName()

    expect(res?.status).toBe(200)
    expect(og.htmls).toHaveLength(2)
    // The retry falls back to the same initial-letter tile an avatar-less name
    // gets, rather than dropping the card entirely.
    expect(og.htmls[1]).not.toContain(AVATAR)
    expect(og.htmls[1]).toContain('>S</div>')
  })

  it('retries when the avatar render yields no bytes instead of throwing', async () => {
    og.render = (html) =>
      html.includes(AVATAR) ? new ArrayBuffer(0) : new ArrayBuffer(8)

    expect((await renderName())?.status).toBe(200)
    expect(og.htmls).toHaveLength(2)
  })

  it('reports null when the card fails to render with or without the avatar', async () => {
    og.render = () => {
      throw new Error('Out of memory')
    }

    // null, not a throw: an uncaught error here reaches the runtime as a 1101,
    // which breaks the card on the name page and every subpage at once.
    expect(await renderName()).toBeNull()
    expect(og.htmls).toHaveLength(2)
  })

  it('does not retry a card that never had an avatar', async () => {
    og.render = () => {
      throw new Error('Out of memory')
    }

    expect(
      await renderOgImage('snowman.eth', null, OWNER, URL_, env),
    ).toBeNull()
    expect(og.htmls).toHaveLength(1)
  })
})
