import { describe, expect, it } from 'vitest'
import { render } from '@/utils/test-utils'
import { FaqSection } from './FaqSection'

describe('FaqSection', () => {
  it('renders the support-docs link with the updated copy, href and target', () => {
    const { getByText } = render(<FaqSection />)

    const link = getByText('Need more help? Visit ENS Support Docs').closest(
      'a',
    )

    expect(link).not.toBeNull()
    expect(link).toHaveAttribute('href', 'https://support.ens.domains')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('places the support-docs link after the FAQ items in DOM order', () => {
    const { getByText } = render(<FaqSection />)

    const lastFaqItem = getByText('How can I secure my ENS name?')
    const link = getByText('Need more help? Visit ENS Support Docs').closest(
      'a',
    )

    expect(link).not.toBeNull()
    // The link node must come *after* the last FAQ item in document order.
    expect(
      lastFaqItem.compareDocumentPosition(link as Node) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('renders the link-out (ExternalLink) icon inside the link, not ArrowRight', () => {
    const { getByText, container } = render(<FaqSection />)

    const link = getByText('Need more help? Visit ENS Support Docs').closest(
      'a',
    )

    expect(link).not.toBeNull()
    // The ticket requires swapping ArrowRight for the link-out ExternalLink icon.
    // lucide-react tags each icon svg with a `lucide-<kebab-name>` class.
    expect(link?.querySelector('.lucide-external-link')).not.toBeNull()
    expect(container.querySelector('.lucide-arrow-right')).toBeNull()
  })
})
