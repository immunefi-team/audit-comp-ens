import '@testing-library/jest-dom'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { getDurationInSecondsFromYears } from '@/features/register-v2/utils/time'
import { DurationCustomRow } from './DurationCustomRow'

i18n.loadAndActivate({ locale: 'en', messages: {} })

describe('DurationCustomRow', () => {
  it('shows the calendar-year expiry date for renewal presets', () => {
    const referenceDate = new Date('2026-07-29T18:00:00.000Z')
    const selectedDuration = getDurationInSecondsFromYears(1, referenceDate)

    render(
      <I18nProvider i18n={i18n}>
        <DurationCustomRow
          isSelected={false}
          onDurationSet={vi.fn()}
          referenceDate={referenceDate}
          selectedDuration={selectedDuration}
          type="renew"
        />
      </I18nProvider>,
    )

    expect(screen.getByText('July 29, 2027')).toBeInTheDocument()
    expect(screen.queryByText('July 30, 2027')).not.toBeInTheDocument()
  })
})
