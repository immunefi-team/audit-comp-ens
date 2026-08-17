import { describe, expect, it, vi } from 'vitest'
import type { QueryChannelRow } from '#services/notifications/helpers.js'

vi.mock('#services/notifications/helpers.js', () => ({
  toPublicChannel: vi.fn(),
}))

vi.mock('#utils/logger.js', () => ({
  logger: {
    warn: vi.fn(),
  },
}))

import { toPublicChannel } from '#services/notifications/helpers.js'
import { logger } from '#utils/logger.js'
import { mapPublicChannels } from './index.js'

const mockedToPublicChannel = vi.mocked(toPublicChannel)
const mockedWarn = vi.mocked(logger.warn)

const baseRow = {
  status: 'verified',
  status_reason: null,
  verified_at: null,
  last_sent_at: null,
  last_bounce_at: null,
  last_verification_sent_at: null,
} satisfies Omit<QueryChannelRow, 'id' | 'channel' | 'target' | 'data'>

describe('mapPublicChannels', () => {
  it('logs and skips channels that fail mapping', async () => {
    const channels: QueryChannelRow[] = [
      {
        ...baseRow,
        id: 'channel-1',
        channel: 'email',
        target: 'test@example.com',
        data: null,
      },
      {
        ...baseRow,
        id: 'channel-2',
        channel: 'push',
        target: null,
        data: null,
      },
    ]

    mockedToPublicChannel
      .mockResolvedValueOnce({
        isErr: () => false,
        value: {
          ...baseRow,
          id: 'channel-1',
          channel: 'email',
          label: 'test@example.com',
        },
      } as never)
      .mockResolvedValueOnce({
        isErr: () => true,
        error: {
          _tag: 'PublicChannelMappingError',
          message: 'missing push target',
        },
      } as never)

    const result = await mapPublicChannels(channels)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'channel-1',
      channel: 'email',
    })
    expect(mockedWarn).toHaveBeenCalledOnce()
    expect(mockedWarn).toHaveBeenCalledWith(
      'Failed to map channel to public representation',
      expect.objectContaining({
        channelId: 'channel-2',
        channelType: 'push',
        errorTag: 'PublicChannelMappingError',
      }),
    )
  })
})
