import '@testing-library/jest-dom'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DurationLabel } from './DurationLabel'

i18n.loadAndActivate({ locale: 'en', messages: {} })

describe('DurationLabel', () => {
  it('renders 1 year 1 day for the day after a calendar-year anniversary', () => {
    const referenceDate = new Date('2026-07-29T18:00:00.000Z')
    const duration = 366 * 86_400

    render(
      <I18nProvider i18n={i18n}>
        <DurationLabel duration={duration} referenceDate={referenceDate} />
      </I18nProvider>,
    )

    expect(screen.getByText('1 year')).toBeInTheDocument()
    expect(screen.getByText('1 day')).toBeInTheDocument()
  })

  it('renders 4 weeks 2 days for short manual renewals from a non-midnight expiry', () => {
    const referenceDate = new Date('2029-10-31T18:00:00.000Z')
    const duration = 30 * 86_400

    render(
      <I18nProvider i18n={i18n}>
        <DurationLabel duration={duration} referenceDate={referenceDate} />
      </I18nProvider>,
    )

    expect(screen.getByText('4 weeks')).toBeInTheDocument()
    expect(screen.getByText('2 days')).toBeInTheDocument()
    expect(screen.queryByText('1 day')).not.toBeInTheDocument()
  })
})
