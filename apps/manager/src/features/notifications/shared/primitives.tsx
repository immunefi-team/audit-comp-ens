import { useLingui } from '@lingui/react/macro'
import { X } from 'lucide-react'
import * as ImageFallback from '@/components/atoms/ImageFallback'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatAbsoluteTime, formatRelativeTime } from '@/utils/time'

export type NotificationPillTone = 'default' | 'success' | 'warning' | 'update'

const pillToneClass: Record<NotificationPillTone, string> = {
  default: 'bg-[#edf2fb] text-[#3558a8]',
  success: 'bg-[#e6f7ea] text-[#1f8a49]',
  warning: 'bg-[#fff4e5] text-[#b26000]',
  update: 'bg-[#EFE5FF] text-[#864FCE]',
}

export const getNotificationActionButtonClass = (
  layout: 'default' | 'compact',
) =>
  layout === 'compact'
    ? 'inline-flex h-8 items-center justify-center rounded-sm border border-[#0b97ea] px-3 font-medium text-[#0b7fd1] text-xs uppercase tracking-[0.015em] transition-colors hover:bg-[#f5fbff]'
    : 'inline-flex h-9 items-center justify-center rounded-sm border border-[#0b97ea] px-4 font-medium text-[#0b7fd1] text-sm uppercase tracking-[0.015em] transition-colors hover:bg-[#f5fbff]'

export const NotificationWrapper = ({
  children,
}: {
  children: React.ReactNode
}) => (
  <article className="space-y-2.5 border-[#e7e8ec] border-b py-5 first:pt-0">
    {children}
  </article>
)

export const NotificationHeader = ({
  category,
  categoryTone = 'default',
  seen,
  timestamp,
  onRemove,
}: {
  category: string
  categoryTone?: NotificationPillTone
  seen: boolean
  timestamp: number
  onMarkAsRead?: () => void
  onRemove?: () => void
}) => {
  const { t } = useLingui()
  return (
    <div className="flex items-center gap-2">
      {seen ? null : <span className="size-2 rounded-full bg-[#ff5a3d]" />}
      <span
        className={`inline-flex items-center rounded-full px-2 py-1 font-normal text-sm leading-none ${pillToneClass[categoryTone]}`}
      >
        {category}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="ml-auto text-[#717182] text-sm">
            {formatRelativeTime(timestamp)}
          </span>
        </TooltipTrigger>
        <TooltipContent>{formatAbsoluteTime(timestamp)}</TooltipContent>
      </Tooltip>
      {onRemove ? (
        <button
          aria-label={t`Remove notification`}
          className="cursor-pointer"
          onClick={onRemove}
          type="button"
        >
          <X className="size-4 text-[#9b9cac]" />
        </button>
      ) : null}
    </div>
  )
}

export const NameDisplay = ({ name }: { name: string }) => (
  <div
    className={
      'wrap-anywhere w-fit max-w-full rounded-sm bg-[#dff0ff] px-2 py-1 font-semibold text-[#086eac] text-base leading-none'
    }
  >
    {name}
  </div>
)

export const NotificationBody = ({
  media,
  main,
  action,
}: {
  media?: React.ReactNode
  main: React.ReactNode
  action?: React.ReactNode
}) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
    {media ? <div className="pt-0.5 sm:shrink-0">{media}</div> : null}
    <div className="min-w-0 flex-1">{main}</div>
    {action ? (
      <div className="self-start sm:ml-3 sm:shrink-0 sm:self-end">{action}</div>
    ) : null}
  </div>
)

export const MediaThumb = ({ src, alt }: { src: string; alt: string }) => (
  <div className="h-14 w-14 overflow-hidden rounded-sm bg-[#f1f2f5]">
    <ImageFallback.Root>
      <ImageFallback.Image
        alt={alt}
        className="h-full w-full object-cover"
        src={src}
      />
      <ImageFallback.Fallback>
        <div className="h-full w-full bg-[#f1f2f5]" />
      </ImageFallback.Fallback>
    </ImageFallback.Root>
  </div>
)

export const NotificationsTitleRow = ({
  title,
  rightSlot,
}: {
  title: string
  rightSlot?: React.ReactNode
}) => (
  <div className="flex items-center justify-between">
    <h1 className="font-normal text-2xl">{title}</h1>
    {rightSlot}
  </div>
)
