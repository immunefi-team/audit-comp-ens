import { useHotkey } from '@tanstack/react-hotkeys'
import type { RefObject } from 'react'

const openFirstSearchResult = (
  resultsContainer: HTMLElement | null,
): boolean => {
  const firstResult =
    resultsContainer?.querySelector<HTMLAnchorElement>('a[href]') ?? null

  if (!firstResult) {
    return false
  }

  firstResult.click()

  return true
}

type UseOpenFirstSearchResultHotkeyParams = {
  readonly enabled?: boolean
  readonly target: RefObject<HTMLElement | null>
  readonly resultsContainer: RefObject<HTMLElement | null>
}

export const useOpenFirstSearchResultHotkey = ({
  enabled = true,
  target,
  resultsContainer,
}: UseOpenFirstSearchResultHotkeyParams) => {
  useHotkey(
    'Enter',
    (event) => {
      if (event.isComposing || event.keyCode === 229) {
        return
      }

      const didNavigate = openFirstSearchResult(resultsContainer.current)

      if (didNavigate) {
        event.preventDefault()
        target.current?.blur()
      }
    },
    {
      enabled,
      ignoreInputs: false,
      preventDefault: false,
      requireReset: true,
      stopPropagation: false,
      target,
    },
  )
}
