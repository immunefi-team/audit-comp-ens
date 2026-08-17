import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_COMMEMORATIVE_NFT_RENDERER_ORIGIN,
  getCommemorativeNftConfig,
} from './config'

describe('commemorative NFT config', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses the configured renderer origin', () => {
    vi.stubEnv(
      'VITE_COMMEMORATIVE_NFT_RENDERER_ORIGIN',
      '  https://renderer.example///  ',
    )

    expect(getCommemorativeNftConfig().rendererOrigin).toBe(
      'https://renderer.example',
    )
  })

  it('falls back to the default renderer origin', () => {
    vi.stubEnv('VITE_COMMEMORATIVE_NFT_RENDERER_ORIGIN', '')

    expect(getCommemorativeNftConfig().rendererOrigin).toBe(
      DEFAULT_COMMEMORATIVE_NFT_RENDERER_ORIGIN,
    )
  })
})
