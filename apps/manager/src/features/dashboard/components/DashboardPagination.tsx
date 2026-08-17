import { Trans, useLingui } from '@lingui/react/macro'
import { CircleArrowLeft, CircleArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPageWindow } from '../pagination'

interface DashboardPaginationProps {
  readonly currentPage: number
  readonly totalPages: number
  readonly onPageChange: (page: number) => void
  readonly rangeStart: number
  readonly rangeEnd: number
  readonly total: number
  readonly disabled?: boolean
}

export const DashboardPagination = ({
  currentPage,
  totalPages,
  onPageChange,
  rangeStart,
  rangeEnd,
  total,
  disabled = false,
}: DashboardPaginationProps) => {
  const { t } = useLingui()
  const pages = getPageWindow(currentPage, totalPages)

  return (
    <div className="flex flex-col gap-3 md:h-14 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center justify-center gap-3">
        <button
          aria-label={t`Previous page`}
          className="flex size-8 items-center justify-center text-ens-blue disabled:text-border"
          disabled={disabled || currentPage <= 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          type="button"
        >
          <CircleArrowLeft className="size-8" strokeWidth={1} />
        </button>

        <div className="flex items-center gap-1">
          {pages.map((page, index) =>
            page === 'ellipsis' ? (
              <span
                className="flex size-8 items-center justify-center font-sans text-ens-quartz-400 text-sm"
                key={`ellipsis-after-${pages[index - 1]}`}
              >
                …
              </span>
            ) : (
              <button
                aria-current={page === currentPage ? 'page' : undefined}
                aria-label={t`Go to page ${page}`}
                className={cn(
                  'flex size-8 items-center justify-center rounded-md font-sans text-base leading-none',
                  page === currentPage
                    ? 'bg-ens-lapis-bg font-medium text-ens-lapis-core'
                    : 'text-ens-quartz-400 hover:bg-ens-quartz-100',
                )}
                disabled={disabled}
                key={page}
                onClick={() => onPageChange(page)}
                type="button"
              >
                {page}
              </button>
            ),
          )}
        </div>

        <button
          aria-label={t`Next page`}
          className="flex size-8 items-center justify-center text-ens-blue disabled:text-border"
          disabled={disabled || currentPage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          type="button"
        >
          <CircleArrowRight className="size-8" strokeWidth={1} />
        </button>
      </div>

      <span className="font-sans text-ens-quartz-400 text-sm leading-[1.2] tracking-[0.14px]">
        <Trans>
          Showing {rangeStart}-{rangeEnd} of {total}
        </Trans>
      </span>
    </div>
  )
}
