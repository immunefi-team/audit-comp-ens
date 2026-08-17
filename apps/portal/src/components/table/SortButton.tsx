import type { SortDirection } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SortButtonProps extends React.ComponentProps<'button'> {
  sortDirection?: SortDirection | false
  className?: string
}

export const SortButton = ({
  children,
  sortDirection,
  className,
  ...props
}: SortButtonProps) => {
  const SortIcon =
    sortDirection === 'asc'
      ? ArrowUp
      : sortDirection === 'desc'
        ? ArrowDown
        : ArrowUpDown

  return (
    <button
      className={cn('p-0 flex flex-row items-center cursor-pointer', className)}
      type="button"
      {...props}
    >
      {children}
      <SortIcon className="ml-2 h-4 w-4" />
    </button>
  )
}
