import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { InvalidNameMessage } from './InvalidNameMessage'

describe('InvalidNameMessage', () => {
  it('renders default title and description with support link', () => {
    render(<InvalidNameMessage />)

    expect(screen.getByText('Invalid name')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'visit our support' }),
    ).toHaveAttribute('href', 'https://support.ens.domains/en/')
  })

  it('renders custom title and description', () => {
    render(
      <InvalidNameMessage
        title="Custom title"
        description={<span>Custom description</span>}
      />,
    )

    expect(screen.getByText('Custom title')).toBeInTheDocument()
    expect(screen.getByText('Custom description')).toBeInTheDocument()
  })
})
