import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ErrorMessage } from './ErrorMessage'

describe('ErrorMessage', () => {
  it('renders with default title and description', () => {
    render(<ErrorMessage />)

    expect(screen.getByText('Error loading page')).toBeInTheDocument()
    expect(
      screen.getByText(
        'This page could not be loaded. Try refreshing the page and check the console log for detailed information.',
      ),
    ).toBeInTheDocument()
  })

  it('renders compact mode with icon and description only', () => {
    render(<ErrorMessage compact />)

    expect(
      screen.getByText('Error fetching data. Please refresh the page.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Error loading page')).not.toBeInTheDocument()
  })

  it('renders with custom title and description', () => {
    render(
      <ErrorMessage
        title="Custom Error"
        description="This is a custom error message"
      />,
    )

    expect(screen.getByText('Custom Error')).toBeInTheDocument()
    expect(
      screen.getByText('This is a custom error message'),
    ).toBeInTheDocument()
  })

  it('renders with description as React node', () => {
    render(
      <ErrorMessage
        title="Error"
        description={<span data-testid="custom-node">Custom Node</span>}
      />,
    )

    expect(screen.getByTestId('custom-node')).toBeInTheDocument()
  })
})
