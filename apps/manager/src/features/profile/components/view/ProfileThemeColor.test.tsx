import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  ProfileThemeColorProvider,
  useProfileThemeColor,
} from './ProfileThemeColor'

const ThemeColorProbe = () => (
  <output data-testid="theme-color">{useProfileThemeColor() ?? ''}</output>
)

describe('ProfileThemeColor', () => {
  it('returns undefined without a profile theme provider', () => {
    render(<ThemeColorProbe />)

    expect(screen.getByTestId('theme-color').textContent).toBe('')
  })

  it('returns the nearest profile theme color from context', () => {
    render(
      <ProfileThemeColorProvider value="#E72A96">
        <ThemeColorProbe />
      </ProfileThemeColorProvider>,
    )

    expect(screen.getByTestId('theme-color').textContent).toBe('#E72A96')
  })
})
