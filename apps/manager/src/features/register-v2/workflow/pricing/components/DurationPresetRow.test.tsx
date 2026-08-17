import '@testing-library/jest-dom'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { getDurationInSecondsFromYears } from '@/features/register-v2/utils/time'
import { DurationPresetRow } from './DurationPresetRow'

i18n.loadAndActivate({ locale: 'en', messages: {} })

describe('DurationPresetRow', () => {
  it('renders the intended preset year label and yearly price from years', () => {
    render(
      <I18nProvider i18n={i18n}>
        <DurationPresetRow
          data={{
            years: 3,
            duration: getDurationInSecondsFromYears(
              3,
              new Date('2026-01-01T18:30:00.000Z'),
            ),
            title: { id: 'committed', message: 'Committed' },
            subtitle: { id: 'make-it-yours', message: 'Make it yours' },
            kind: 'mostPopular',
            color: 'peridot',
          }}
          isLoading={false}
          isSelected={false}
          onSelect={vi.fn()}
          price={42}
        />
      </I18nProvider>,
    )

    expect(screen.getByText('3 years')).toBeInTheDocument()
    expect(screen.queryByText(/6 hours/i)).not.toBeInTheDocument()
    expect(screen.getByText('$14.00/year')).toBeInTheDocument()
  })
})
