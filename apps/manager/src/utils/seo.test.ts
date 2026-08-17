import { describe, expect, it } from 'vitest'
import { BASE_URL, seo } from './seo'

describe('seo utils', () => {
  describe('BASE_URL', () => {
    it('should be a valid URL object', () => {
      expect(BASE_URL).toBeInstanceOf(URL)
    })

    it('should have a valid href', () => {
      expect(BASE_URL.href).toBeTruthy()
      expect(BASE_URL.href).toMatch(/^https?:\/\//)
    })
  })

  describe('seo', () => {
    it('should generate meta tags with title', () => {
      const tags = seo({ title: 'Test Page' })

      expect(tags).toContainEqual({ title: 'Test Page' })
      expect(tags).toContainEqual({
        name: 'twitter:title',
        content: 'Test Page',
      })
      expect(tags).toContainEqual({ name: 'og:title', content: 'Test Page' })
    })

    it('should generate meta tags with description', () => {
      const tags = seo({
        title: 'Test Page',
        description: 'Test description',
      })

      expect(tags).toContainEqual({
        name: 'description',
        content: 'Test description',
      })
      expect(tags).toContainEqual({
        name: 'twitter:description',
        content: 'Test description',
      })
      expect(tags).toContainEqual({
        name: 'og:description',
        content: 'Test description',
      })
    })

    it('should generate meta tags with keywords', () => {
      const tags = seo({
        title: 'Test Page',
        keywords: 'test, keywords, seo',
      })

      expect(tags).toContainEqual({
        name: 'keywords',
        content: 'test, keywords, seo',
      })
    })

    it('should include twitter metadata', () => {
      const tags = seo({ title: 'Test Page' })

      expect(tags).toContainEqual({
        name: 'twitter:creator',
        content: '@ensdomains',
      })
      expect(tags).toContainEqual({
        name: 'twitter:site',
        content: '@ensdomains',
      })
    })

    it('should include Open Graph metadata', () => {
      const tags = seo({ title: 'Test Page' })

      expect(tags).toContainEqual({ name: 'og:type', content: 'website' })
    })

    it('should include image tags when image is provided', () => {
      const tags = seo({
        title: 'Test Page',
        image: 'https://example.com/image.jpg',
      })

      expect(tags).toContainEqual({
        name: 'twitter:image',
        content: 'https://example.com/image.jpg',
      })
      expect(tags).toContainEqual({
        name: 'twitter:card',
        content: 'summary_large_image',
      })
      expect(tags).toContainEqual({
        name: 'og:image',
        content: 'https://example.com/image.jpg',
      })
    })

    it('should not include image tags when image is not provided', () => {
      const tags = seo({ title: 'Test Page' })

      const imageTag = tags.find((tag) =>
        'name' in tag ? tag.name === 'twitter:image' : false,
      )
      const cardTag = tags.find((tag) =>
        'name' in tag ? tag.name === 'twitter:card' : false,
      )
      const ogImageTag = tags.find((tag) =>
        'name' in tag ? tag.name === 'og:image' : false,
      )

      expect(imageTag).toBeUndefined()
      expect(cardTag).toBeUndefined()
      expect(ogImageTag).toBeUndefined()
    })

    it('should handle all parameters together', () => {
      const tags = seo({
        title: 'Full Test',
        description: 'Full description',
        keywords: 'full, test, seo',
        image: 'https://example.com/full.jpg',
      })

      expect(tags.length).toBeGreaterThan(0)
      expect(tags).toContainEqual({ title: 'Full Test' })
      expect(tags).toContainEqual({
        name: 'description',
        content: 'Full description',
      })
      expect(tags).toContainEqual({
        name: 'keywords',
        content: 'full, test, seo',
      })
      expect(tags).toContainEqual({
        name: 'twitter:image',
        content: 'https://example.com/full.jpg',
      })
    })

    it('should handle undefined description', () => {
      const tags = seo({ title: 'Test Page', description: undefined })

      const descTag = tags.find((tag) =>
        'name' in tag ? tag.name === 'description' : false,
      )
      expect(descTag).toEqual({ name: 'description', content: undefined })
    })

    it('should handle undefined keywords', () => {
      const tags = seo({ title: 'Test Page', keywords: undefined })

      const keywordsTag = tags.find((tag) =>
        'name' in tag ? tag.name === 'keywords' : false,
      )
      expect(keywordsTag).toEqual({ name: 'keywords', content: undefined })
    })

    it('should return array of meta tag objects', () => {
      const tags = seo({ title: 'Test Page' })

      expect(Array.isArray(tags)).toBe(true)
      expect(tags.length).toBeGreaterThan(0)
    })

    it('should include all required meta tags', () => {
      const tags = seo({ title: 'Test Page' })

      const tagNames = tags
        .filter(
          (tag): tag is { name: string; content?: string } => 'name' in tag,
        )
        .map((tag) => tag.name)

      expect(tagNames).toContain('description')
      expect(tagNames).toContain('keywords')
      expect(tagNames).toContain('twitter:title')
      expect(tagNames).toContain('twitter:description')
      expect(tagNames).toContain('twitter:creator')
      expect(tagNames).toContain('twitter:site')
      expect(tagNames).toContain('og:type')
      expect(tagNames).toContain('og:title')
      expect(tagNames).toContain('og:description')
    })

    it('should handle empty string values', () => {
      const tags = seo({
        title: '',
        description: '',
        keywords: '',
        image: '',
      })

      expect(tags).toContainEqual({ title: '' })
      expect(tags).toContainEqual({ name: 'description', content: '' })
      expect(tags).toContainEqual({ name: 'keywords', content: '' })
    })

    it('should handle long values', () => {
      const longTitle = 'A'.repeat(200)
      const longDescription = 'B'.repeat(500)

      const tags = seo({
        title: longTitle,
        description: longDescription,
      })

      expect(tags).toContainEqual({ title: longTitle })
      expect(tags).toContainEqual({
        name: 'description',
        content: longDescription,
      })
    })
  })
})
