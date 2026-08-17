import { useEffect, useState } from 'react'
import { copyToClipboard } from '@/lib/clipboard'

const COPY_FEEDBACK_TIMEOUT = 1500

export function useCopyFeedback() {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), COPY_FEEDBACK_TIMEOUT)
    return () => clearTimeout(t)
  }, [copied])

  const copy = async (value: string) => {
    try {
      await copyToClipboard(value)
      setCopied(true)
    } catch {
      // Clipboard access denied or unavailable — silently ignore
    }
  }

  return { copied, copy }
}
