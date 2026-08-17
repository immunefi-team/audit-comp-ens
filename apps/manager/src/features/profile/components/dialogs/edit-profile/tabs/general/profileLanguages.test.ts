import { afterEach, describe, expect, it, vi } from 'vitest'

const loadProfileLanguageOptions = async () => {
  vi.resetModules()
  return (await import('./profileLanguages')).profileLanguageOptions
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('profile language options', () => {
  it('offers a broad metadata language list beyond the app i18n locales', async () => {
    const profileLanguageOptions = await loadProfileLanguageOptions()
    const values = profileLanguageOptions.map(({ value }) => value)

    expect(profileLanguageOptions.length).toBeGreaterThan(150)
    expect(values).toContain('ar')
    expect(values).toContain('hi')
    expect(values).toContain('ja')
    expect(values).toContain('yo')
  })

  it('keeps options sorted and unique for a native select', async () => {
    const profileLanguageOptions = await loadProfileLanguageOptions()
    const labels = profileLanguageOptions.map(({ label }) => label)
    const values = profileLanguageOptions.map(({ value }) => value)

    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)))
    expect(new Set(values).size).toBe(values.length)
  })

  it('does not show raw language codes when runtime display names are missing', async () => {
    vi.stubGlobal(
      'Intl',
      Object.assign({}, Intl, {
        DisplayNames: class {
          of(value: string) {
            return value
          }
        },
      }),
    )

    const profileLanguageOptions = await loadProfileLanguageOptions()

    expect(profileLanguageOptions).toContainEqual({
      label: 'Afar',
      value: 'aa',
    })
    expect(profileLanguageOptions).toContainEqual({
      label: 'Abkhazian',
      value: 'ab',
    })
    expect(profileLanguageOptions).toContainEqual({
      label: 'Avestan',
      value: 'ae',
    })
    expect(
      profileLanguageOptions.filter(({ label, value }) => label === value),
    ).toEqual([])
  })
})
