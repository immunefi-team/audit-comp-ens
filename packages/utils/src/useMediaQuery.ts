import { useEffect, useState } from 'react'

export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)

    // Set initial value
    setMatches(media.matches)

    // Create event listener function
    const listener = (e: MediaQueryListEvent) => {
      setMatches(e.matches)
    }

    // Add event listener
    media.addEventListener('change', listener)

    // Cleanup function
    return () => {
      media.removeEventListener('change', listener)
    }
  }, [query])

  return matches
}
