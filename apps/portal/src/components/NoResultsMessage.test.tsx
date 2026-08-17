import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NoResultsMessage } from './NoResultsMessage'

describe('NoResultsMessage', () => {
  it('should render with default title and description', () => {
    render(<NoResultsMessage />)

    expect(screen.getByText('No results found')).toBeInTheDocument()
    expect(
      screen.getByText("There's nothing here yet. Check back later!"),
    ).toBeInTheDocument()
  })

  it('should render with custom title', () => {
    render(<NoResultsMessage title="Custom Title" />)

    expect(screen.getByText('Custom Title')).toBeInTheDocument()
    expect(
      screen.getByText("There's nothing here yet. Check back later!"),
    ).toBeInTheDocument()
  })

  it('should render with custom description', () => {
    render(<NoResultsMessage description="Custom description text" />)

    expect(screen.getByText('No results found')).toBeInTheDocument()
    expect(screen.getByText('Custom description text')).toBeInTheDocument()
    expect(
      screen.queryByText("There's nothing here yet. Check back later!"),
    ).not.toBeInTheDocument()
  })

  it('should render with custom title and description', () => {
    render(
      <NoResultsMessage
        title="No history"
        description="This name has no recorded activity."
      />,
    )

    expect(screen.getByText('No history')).toBeInTheDocument()
    expect(
      screen.getByText('This name has no recorded activity.'),
    ).toBeInTheDocument()
  })

  it('should render with React node as description', () => {
    render(
      <NoResultsMessage
        description={
          <span>
            No data found. <a href="/help">Get help</a>
          </span>
        }
      />,
    )

    expect(screen.getByText('No results found')).toBeInTheDocument()
    expect(screen.getByText('No data found.')).toBeInTheDocument()
    expect(screen.getByText('Get help')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Get help' })).toHaveAttribute(
      'href',
      '/help',
    )
  })

  it('should render MessageCard with correct structure', () => {
    const { container } = render(<NoResultsMessage />)

    // Check that MessageCard is rendered
    const messageCard = container.querySelector('[data-slot="message-card"]')
    expect(messageCard).toBeInTheDocument()
  })
})
