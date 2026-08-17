import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CopyableRecord } from './CopyableRecord'

describe('CopyableRecord', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn() },
      configurable: true,
    })
  })

  it('writes the value to the clipboard when the copy button is clicked', async () => {
    render(<CopyableRecord value="0x1234567890abcdef" />)

    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        '0x1234567890abcdef',
      )
    })
  })

  it('shows a check icon after clicking copy', async () => {
    render(<CopyableRecord value="0x1234567890abcdef" />)

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

  it('copies the raw value even when a display value is provided', async () => {
    render(
      <CopyableRecord
        value="0x1234567890abcdef"
        href="https://example.com"
        displayValue={<span>0x1234…cdef</span>}
      />,
    )

    expect(screen.getByRole('link')).toHaveTextContent('0x1234…cdef')

    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        '0x1234567890abcdef',
      )
    })
  })
})
