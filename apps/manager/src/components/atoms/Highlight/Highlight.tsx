import { cn } from '@/lib/utils'

export const Highlight = ({
  children,
  className,
}: {
  readonly children: React.ReactNode
  readonly className?: string
}) => {
  return (
    <span
      className={cn(
        'wrap-anywhere w-fit max-w-3/4 rounded-md bg-gray-800 p-1.5 font-mono text-sm text-white leading-ens-none',
        className,
      )}
    >
      {children}
    </span>
  )
}
