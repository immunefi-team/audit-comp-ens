import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CopyButton } from './CopyButton'

describe('CopyButton', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn() },
      configurable: true,
    })
  })

  it('writes the value to the clipboard when clicked', async () => {
    render(<CopyButton value="0x1234567890abcdef" />)

    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        '0x1234567890abcdef',
      )
    })
  })

  it('shows a check icon after clicking copy', async () => {
    render(<CopyButton value="test-value" />)

    const button = screen.getByRole('button')
    const beforeIcon = button.querySelector('svg')
    expect(beforeIcon).toBeTruthy()

    fireEvent.click(button)

    await waitFor(() => {
      const afterIcon = button.querySelector('svg')
      expect(afterIcon).toBeTruthy()
      expect(afterIcon).not.toBe(beforeIcon)
    })
  })

  it('reverts to copy icon after 2 seconds', async () => {
    vi.useFakeTimers()

    render(<CopyButton value="test-value" />)

    const button = screen.getByRole('button')

    // Get the initial icon content
    const initialIconHtml = button.querySelector('svg')?.innerHTML
    expect(initialIconHtml).toBeTruthy()

    // Click to copy - wrap in act since it triggers state update
    await act(async () => {
      fireEvent.click(button)
    })

    // After click, icon should change (different innerHTML)
    const checkIconHtml = button.querySelector('svg')?.innerHTML
    expect(checkIconHtml).toBeTruthy()
    expect(checkIconHtml).not.toBe(initialIconHtml)

    // Advance timers by 2 seconds (wrapped in act to handle state update)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    // Should revert back to copy icon (same innerHTML as initial)
    const revertedIconHtml = button.querySelector('svg')?.innerHTML
    expect(revertedIconHtml).toBeTruthy()
    expect(revertedIconHtml).toBe(initialIconHtml)

    vi.useRealTimers()
  })

  it('has accessible screen reader text', () => {
    render(<CopyButton value="test-value" />)

    expect(screen.getByText('Copy value')).toBeInTheDocument()
  })
})
