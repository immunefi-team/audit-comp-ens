import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NotFoundMessage } from './NotFoundMessage'

describe('NotFoundMessage', () => {
  it('renders default title and description with support link', () => {
    render(<NotFoundMessage />)

    expect(screen.getByText('Not found')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'visit our support' }),
    ).toHaveAttribute('href', 'https://support.ens.domains/en/')
  })

  it('renders custom title and description', () => {
    render(
      <NotFoundMessage
        title="Custom title"
        description={<span>Custom description</span>}
      />,
    )

    expect(screen.getByText('Custom title')).toBeInTheDocument()
    expect(screen.getByText('Custom description')).toBeInTheDocument()
  })
})
