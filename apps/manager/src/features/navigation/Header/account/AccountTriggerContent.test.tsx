import { generatePatternDataURI } from '@ensdomains/etherloom'
import { screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useConnectedAvatar } from '@/features/wallet/hooks/useConnectedAvatar'
import { useConnectedReverseName } from '@/features/wallet/hooks/useConnectedReverseName'
import { useSmartAccountContext } from '@/lib/smart-account/SmartAccountContext'
import { render } from '@/utils/test-utils'
import { AccountTriggerContent } from './AccountTriggerContent'

vi.mock('@/features/wallet/hooks/useConnectedAvatar', () => ({
  useConnectedAvatar: vi.fn(),
}))

vi.mock('@/features/wallet/hooks/useConnectedReverseName', () => ({
  useConnectedReverseName: vi.fn(),
}))

vi.mock('@/lib/smart-account/SmartAccountContext', () => ({
  useSmartAccountContext: vi.fn(),
}))

const originalImage = window.Image
const etherloomOptions = {
  cellSize: 10,
  height: 96,
  width: 96,
  padding: 10,
} as const

class LoadedImage extends EventTarget {
  complete = true
  naturalWidth = 1
  src = ''
}

const mockAccountState = () => {
  vi.mocked(useSmartAccountContext).mockReturnValue({
    isLoading: false,
    ownerAddress: '0x1234567890123456789012345678901234567890',
  } as unknown as ReturnType<typeof useSmartAccountContext>)
}

const mockReverseName = () => {
  vi.mocked(useConnectedReverseName).mockReturnValue({
    data: 'fgeorgescu.eth',
  } as unknown as ReturnType<typeof useConnectedReverseName>)
}

const mockAvatar = ({
  themeColor,
  url,
}: {
  readonly themeColor?: string
  readonly url?: string
}) => {
  vi.mocked(useConnectedAvatar).mockReturnValue({
    error: null,
    isLoading: false,
    themeColor,
    url,
  } as ReturnType<typeof useConnectedAvatar>)
}

describe('AccountTriggerContent', () => {
  beforeEach(() => {
    window.Image = LoadedImage as unknown as typeof window.Image
    mockAccountState()
    mockReverseName()
  })

  afterEach(() => {
    window.Image = originalImage
    vi.clearAllMocks()
  })

  it('renders uploaded navbar avatars with subtle square rounding', async () => {
    mockAvatar({ url: 'https://example.com/avatar.png' })

    render(<AccountTriggerContent />)

    const avatar = await screen.findByRole('img', { name: 'ENS Avatar' })

    expect(avatar).toHaveClass('rounded-sm')
    expect(avatar).not.toHaveClass('rounded-full')
  })

  it('renders generated navbar avatars with subtle square rounding', async () => {
    mockAvatar({ themeColor: '#984D1B' })

    render(<AccountTriggerContent />)

    await waitFor(() => {
      expect(
        screen.getByRole('img', { name: 'fgeorgescu.eth pattern' }),
      ).toBeInTheDocument()
    })

    const fallbackAvatar = screen.getByRole('img', {
      name: 'fgeorgescu.eth pattern',
    })

    expect(fallbackAvatar).toHaveAttribute(
      'src',
      generatePatternDataURI(
        'fgeorgescu.eth',
        'ENS Vertical Pairs',
        '#984D1B',
        etherloomOptions,
      ),
    )
    expect(fallbackAvatar.parentElement).toHaveClass('rounded-sm')
    expect(fallbackAvatar.parentElement).not.toHaveClass('rounded-full')
  })
})
