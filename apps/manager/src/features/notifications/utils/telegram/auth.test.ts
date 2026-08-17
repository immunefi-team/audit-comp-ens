import { describe, expect, it } from 'vitest'
import { decodeTelegramAuthDataFromUrlHash } from './auth'

describe('telegram auth', () => {
  describe('decodeTelegramAuthDataFromUrlHash', () => {
    it('should decode valid base64 encoded auth data from hash', () => {
      const authData = {
        id: 123456789,
        first_name: 'John',
        last_name: 'Doe',
        username: 'johndoe',
        auth_date: 1704067200,
        hash: 'abc123',
      }
      const encoded = btoa(JSON.stringify(authData))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')

      const hash = `#tgAuthResult=${encoded}`
      const result = decodeTelegramAuthDataFromUrlHash(hash)

      expect(result).toEqual(authData)
    })

    it('should return null for hash without tgAuthResult', () => {
      const hash = '#someOtherHash=value'
      const result = decodeTelegramAuthDataFromUrlHash(hash)

      expect(result).toBeNull()
    })

    it('should return null for empty hash', () => {
      const result = decodeTelegramAuthDataFromUrlHash('')

      expect(result).toBeNull()
    })

    it('should return null for hash with only fragment marker', () => {
      const result = decodeTelegramAuthDataFromUrlHash('#')

      expect(result).toBeNull()
    })

    it('should handle tgAuthResult with query parameter prefix', () => {
      const authData = { id: 123, username: 'test' }
      const encoded = btoa(JSON.stringify(authData))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')

      const hash = `?tgAuthResult=${encoded}`
      const result = decodeTelegramAuthDataFromUrlHash(hash)

      expect(result).toEqual(authData)
    })

    it('should handle tgAuthResult with ampersand prefix', () => {
      const authData = { id: 456, username: 'user' }
      const encoded = btoa(JSON.stringify(authData))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')

      const hash = `&tgAuthResult=${encoded}`
      const result = decodeTelegramAuthDataFromUrlHash(hash)

      expect(result).toEqual(authData)
    })

    it('should return null for invalid base64 encoding', () => {
      const hash = '#tgAuthResult=!!!invalid-base64!!!'
      const result = decodeTelegramAuthDataFromUrlHash(hash)

      expect(result).toBeNull()
    })

    it('should return null for valid base64 but invalid JSON', () => {
      const encoded = btoa('not valid json')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')

      const hash = `#tgAuthResult=${encoded}`
      const result = decodeTelegramAuthDataFromUrlHash(hash)

      expect(result).toBeNull()
    })

    it('should handle base64 URL-safe encoding with padding', () => {
      const authData = { id: 1, a: 'test++//==' }
      const encoded = btoa(JSON.stringify(authData))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')

      const hash = `#tgAuthResult=${encoded}`
      const result = decodeTelegramAuthDataFromUrlHash(hash)

      expect(result).toEqual(authData)
    })

    it('should decode auth data with unicode characters', () => {
      const authData = {
        id: 123,
        first_name: 'Иван',
        last_name: 'Петров',
      }
      const encoded = btoa(
        unescape(encodeURIComponent(JSON.stringify(authData))),
      )
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')

      const hash = `#tgAuthResult=${encoded}`
      const result = decodeTelegramAuthDataFromUrlHash(hash)

      expect(result).not.toBeNull()
    })

    it('should return null for empty tgAuthResult value', () => {
      const hash = '#tgAuthResult='
      const result = decodeTelegramAuthDataFromUrlHash(hash)

      expect(result).toBeNull()
    })

    it('should only match tgAuthResult at end of string', () => {
      const authData = { id: 999 }
      const encoded = btoa(JSON.stringify(authData))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')

      const hashWithTrailing = `#tgAuthResult=${encoded}&extra=param`
      const result = decodeTelegramAuthDataFromUrlHash(hashWithTrailing)

      expect(result).toBeNull()
    })

    it('should handle minimal auth data', () => {
      const authData = { id: 1 }
      const encoded = btoa(JSON.stringify(authData))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')

      const hash = `#tgAuthResult=${encoded}`
      const result = decodeTelegramAuthDataFromUrlHash(hash)

      expect(result).toEqual(authData)
    })

    it('should handle auth data with photo_url', () => {
      const authData = {
        id: 123456789,
        first_name: 'John',
        username: 'johndoe',
        photo_url: 'https://t.me/i/userpic/320/john.jpg',
        auth_date: 1704067200,
        hash: 'abcdef123456',
      }
      const encoded = btoa(JSON.stringify(authData))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')

      const hash = `#tgAuthResult=${encoded}`
      const result = decodeTelegramAuthDataFromUrlHash(hash)

      expect(result).toEqual(authData)
    })
  })
})
