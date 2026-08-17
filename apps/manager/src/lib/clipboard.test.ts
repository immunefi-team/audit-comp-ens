import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { copyToClipboard } from './clipboard'

describe('clipboard', () => {
  const mockWriteText = vi.fn()

  beforeEach(() => {
    // Use Object.defineProperty to mock navigator.clipboard since it's read-only
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mockWriteText,
      },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('copyToClipboard', () => {
    it('should call navigator.clipboard.writeText with the provided value', async () => {
      mockWriteText.mockResolvedValueOnce(undefined)

      await copyToClipboard('test value')

      expect(mockWriteText).toHaveBeenCalledWith('test value')
      expect(mockWriteText).toHaveBeenCalledTimes(1)
    })

    it('should handle empty string', async () => {
      mockWriteText.mockResolvedValueOnce(undefined)

      await copyToClipboard('')

      expect(mockWriteText).toHaveBeenCalledWith('')
    })

    it('should handle strings with special characters', async () => {
      mockWriteText.mockResolvedValueOnce(undefined)
      const specialString = 'Test with special chars: @#$%^&*()!'

      await copyToClipboard(specialString)

      expect(mockWriteText).toHaveBeenCalledWith(specialString)
    })

    it('should handle multiline strings', async () => {
      mockWriteText.mockResolvedValueOnce(undefined)
      const multilineString = 'Line 1\nLine 2\nLine 3'

      await copyToClipboard(multilineString)

      expect(mockWriteText).toHaveBeenCalledWith(multilineString)
    })

    it('should handle unicode characters', async () => {
      mockWriteText.mockResolvedValueOnce(undefined)
      const unicodeString = '🚀 Hello 世界 مرحبا'

      await copyToClipboard(unicodeString)

      expect(mockWriteText).toHaveBeenCalledWith(unicodeString)
    })

    it('should propagate errors from clipboard API', async () => {
      const error = new Error('Clipboard access denied')
      mockWriteText.mockRejectedValueOnce(error)

      await expect(copyToClipboard('test')).rejects.toThrow(
        'Clipboard access denied',
      )
    })

    it('should handle long strings', async () => {
      mockWriteText.mockResolvedValueOnce(undefined)
      const longString = 'a'.repeat(10000)

      await copyToClipboard(longString)

      expect(mockWriteText).toHaveBeenCalledWith(longString)
    })

    it('should handle whitespace-only strings', async () => {
      mockWriteText.mockResolvedValueOnce(undefined)
      const whitespaceString = '   \t\n   '

      await copyToClipboard(whitespaceString)

      expect(mockWriteText).toHaveBeenCalledWith(whitespaceString)
    })
  })
})
