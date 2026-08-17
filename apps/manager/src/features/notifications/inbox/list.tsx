import { notificationDefinitions } from '@ens-apps/shared-schema/notifications'
import { Trans } from '@lingui/react/macro'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Link as RouterLink } from '@tanstack/react-router'
import { ArrowRightIcon, Loader2Icon } from 'lucide-react'
import { useInView } from 'motion/react'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { MSymbol } from '@/components/ui/material-symbol'
import { notificationsInfiniteQuery } from '@/features/notifications/data/queries/notifications'
import { groupNotificationsByTime } from '@/features/notifications/utils/grouping'
import { NotificationItem } from './notification-item'

type NotificationsListProps = {
  unreadOnly?: boolean
  selectedTag?: string
}

const LoadMoreButton = ({
  isFetchingNextPage,
  fetchNextPage,
  hasNextPage,
}: {
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  hasNextPage: boolean
}) => {
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const isLoadMoreInView = useInView(loadMoreRef)

  // When the load more button is in view and there are more pages to fetch, fetch the next page.
  useEffect(() => {
    if (isLoadMoreInView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [isLoadMoreInView, hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <div className="flex items-center gap-3" ref={loadMoreRef}>
      <Button
        className="w-fit"
        disabled={isFetchingNextPage}
        onClick={() => fetchNextPage()}
        variant="outline"
      >
        {isFetchingNextPage ? (
          <Trans>Loading...</Trans>
        ) : (
          <Trans>Load more</Trans>
        )}
      </Button>
      {isFetchingNextPage ? (
        <Loader2Icon className="size-5 animate-spin text-[#717182]" />
      ) : null}
    </div>
  )
}

export const NotificationsList = ({
  unreadOnly = false,
  selectedTag = 'all',
}: NotificationsListProps) => {
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery(notificationsInfiniteQuery)

  const filteredData =
    data?.filter((notification) => {
      if (unreadOnly && notification.seen) return false

      if (selectedTag === 'all') return true

      const tags =
        (notificationDefinitions[notification.kind].metadata.tags as
          | readonly string[]
          | undefined) ?? []
      return tags.includes(selectedTag)
    }) ?? []
  const grouped = groupNotificationsByTime(filteredData)

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center">
        <Loader2Icon className="size-10 animate-spin" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="text-ens-garnet-core text-sm">
          <Trans>Failed to load notifications</Trans>
        </div>
      </div>
    )
  }

  if (filteredData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-10">
        <div className="text-[#717182] text-base">
          <Trans>Nothing here yet!</Trans>
        </div>
        <RouterLink
          className="group flex items-center gap-2"
          to="/notifications/settings"
        >
          <MSymbol
            className="ms-opsz-30 ms-wght-200 text-[#232222]"
            symbol="settings"
          />
          <div className="font-normal text-[#232222] text-base leading-ens-normal group-hover:underline max-sm:hidden">
            <Trans>Manage notification settings</Trans>
          </div>
          <ArrowRightIcon className="size-4 text-ens-lapis-core transition-transform group-hover:translate-x-0.5 max-sm:hidden" />
        </RouterLink>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {grouped.groups.map((group) => (
        <section className="space-y-4" key={group.title}>
          <h3 className="text-[#232222] text-xl leading-ens-none">
            {group.title}
          </h3>
          <div className="flex flex-col">
            {group.notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
              />
            ))}
          </div>
        </section>
      ))}
      {hasNextPage ? (
        <LoadMoreButton
          fetchNextPage={fetchNextPage}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
        />
      ) : null}
    </div>
  )
}
