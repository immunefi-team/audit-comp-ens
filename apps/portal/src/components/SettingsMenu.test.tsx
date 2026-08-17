import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

const displaySurvey = vi.fn()

vi.mock('@posthog/react', () => ({
  usePostHog: () => ({ displaySurvey }),
}))

vi.mock('./ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}))

// FEEDBACK_SURVEY_ID is read at module scope, so the env must be stubbed
// before a fresh import of the component.
const importSettingsMenu = async (surveyId: string | undefined) => {
  vi.resetModules()
  vi.stubEnv('VITE_PUBLIC_POSTHOG_FEEDBACK_SURVEY_ID', surveyId)
  return (await import('./SettingsMenu')).SettingsMenu
}

afterEach(() => {
  vi.unstubAllEnvs()
  displaySurvey.mockClear()
})

describe('SettingsMenu', () => {
  it('opens the feedback survey with the configured id', async () => {
    const SettingsMenu = await importSettingsMenu('survey-123')
    const user = userEvent.setup()
    render(<SettingsMenu />)

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(await screen.findByRole('menuitem', { name: /feedback/i }))

    expect(displaySurvey).toHaveBeenCalledWith('survey-123', {
      displayType: 'popover',
      ignoreConditions: true,
      ignoreDelay: true,
    })
  })

  it('hides the feedback item when no survey id is configured', async () => {
    const SettingsMenu = await importSettingsMenu(undefined)
    const user = userEvent.setup()
    render(<SettingsMenu />)

    await user.click(screen.getByRole('button', { name: 'Settings' }))

    expect(await screen.findByTestId('theme-toggle')).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /feedback/i })).toBeNull()
  })
})
