import { describe, expect, it, vi } from 'vitest'
import { cspMetaTag } from './csp'
import { MetaTagInjector, TitleRewriter } from './html-rewriter'

describe('html-rewriter', () => {
  describe('MetaTagInjector', () => {
    it('should create instance with tags', () => {
      const tags = '<meta name="description" content="test">'
      const injector = new MetaTagInjector(tags)
      expect(injector).toBeDefined()
    })

    it('should append tags to element', () => {
      const tags = '<meta name="description" content="test">'
      const injector = new MetaTagInjector(tags)

      const mockAppend = vi.fn()
      const mockElement = {
        append: mockAppend,
      } as unknown as Element

      injector.element(mockElement)

      // The injector prepends the CSP meta tag (defense-in-depth) before the
      // provided tags, so the appended content carries both.
      expect(mockAppend).toHaveBeenCalledWith(`${cspMetaTag}\n${tags}`, {
        html: true,
      })
    })
  })

  describe('TitleRewriter', () => {
    it('should create instance with title', () => {
      const title = 'Test Title'
      const rewriter = new TitleRewriter(title)
      expect(rewriter).toBeDefined()
    })

    it('should set inner content on element', () => {
      const title = 'Test Title'
      const rewriter = new TitleRewriter(title)

      const mockSetInnerContent = vi.fn()
      const mockElement = {
        setInnerContent: mockSetInnerContent,
      } as unknown as Element

      rewriter.element(mockElement)

      expect(mockSetInnerContent).toHaveBeenCalledWith(title)
    })
  })
})
