import { Link } from '@tanstack/react-router'
import { CheckIcon, CopyIcon } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { ExternalLink } from 'react-external-link'
import { cn } from '@/lib/utils'

const isInternalLink = (href: string): boolean => {
  return href.startsWith('/') && !href.startsWith('//')
}

export const CopyableRecord = ({
  value,
  className,
  href,
  displayValue,
  truncate = true,
  textClassName,
}: {
  value: string | number
  className?: string
  href?: string
  displayValue?: ReactNode
  truncate?: boolean
  textClassName?: string
}) => {
  const [copy, setCopy] = useState(false)

  useEffect(() => {
    if (copy) {
      navigator.clipboard.writeText(value.toString())
      // Reset checkmark back to copy icon after 2 seconds
      const timer = setTimeout(() => setCopy(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [copy, value])

  const content = displayValue || value

  const linkClassName = cn(
    'text-sm sm:text-base font-mono underline decoration-dashed underline-offset-4 min-w-0',
    truncate && 'truncate',
  )

  return (
    <div
      className={cn(
        'flex items-center gap-2 w-full', // changed inline-flex → flex, ensure full width
        className,
      )}
    >
      {href ? (
        isInternalLink(href) ? (
          <Link to={href} className={linkClassName}>
            {content}
          </Link>
        ) : (
          <ExternalLink className={linkClassName} href={href}>
            {content}
          </ExternalLink>
        )
      ) : (
        <div
          className={cn(
            'text-sm sm:text-base font-mono min-w-0',
            truncate && 'truncate',
            textClassName,
          )}
        >
          {content}
        </div>
      )}
      <button
        className="shrink-0 cursor-pointer"
        type="button"
        onClick={() => setCopy(true)}
      >
        {copy ? (
          <CheckIcon className="size-3" />
        ) : (
          <CopyIcon className="size-3" />
        )}
      </button>
    </div>
  )
}
