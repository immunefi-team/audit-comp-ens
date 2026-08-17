import { useLingui } from '@lingui/react/macro'
import { Check, Copy } from 'lucide-react'
import { useCopyFeedback } from '@/hooks/useCopyFeedback'

interface CopyToClipboardProps {
  value: string
  className?: string
}

export const CopyToClipboard = ({ value, className }: CopyToClipboardProps) => {
  const { t } = useLingui()
  const { copied, copy } = useCopyFeedback()

  return (
    <button
      aria-label={t`Copy to clipboard`}
      className="inline-flex items-center justify-center"
      onClick={() => copy(value)}
      title={t`Copy to clipboard`}
      type="button"
    >
      {copied ? (
        <Check className={className} />
      ) : (
        <Copy className={className} />
      )}
    </button>
  )
}
