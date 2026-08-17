import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'ens-portal-theme'

function applyTheme(theme: Theme) {
  const root = document.documentElement
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark)
  root.classList.toggle('dark', isDark)
}

/**
 * The effective light/dark mode from the stored preference, resolved outside
 * React (e.g. to theme the WalletConnect modal at connector-creation time).
 */
export function getResolvedThemeMode(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'system'
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return stored === 'dark' || (stored === 'system' && prefersDark)
    ? 'dark'
    : 'light'
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'system',
  )

  // Apply on mount and whenever theme changes
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Re-apply when system preference changes (only relevant in 'system' mode)
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (theme === 'system') applyTheme('system')
    }
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem(STORAGE_KEY, next)
    setThemeState(next)
  }, [])

  return { theme, setTheme }
}
