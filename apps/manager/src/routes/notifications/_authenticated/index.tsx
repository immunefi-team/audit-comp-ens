import { notificationDefinitions } from '@ens-apps/shared-schema/notifications'
import { Trans, useLingui } from '@lingui/react/macro'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Field, FieldLabel } from '@/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { MSymbol } from '@/components/ui/material-symbol'
import { Switch } from '@/components/ui/switch'
import {
  markAllNotificationsReadMutationOptions,
  notificationsInfiniteQuery,
} from '@/features/notifications/data/queries/notifications'
import { FilterBadge } from '@/features/notifications/inbox/filter-badge'
import { NotificationsList } from '@/features/notifications/inbox/list'
import { UnreadCount } from '@/features/notifications/inbox/unread-count'

export const AllNotificationsPage = () => {
  const { t } = useLingui()
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const markAllAsRead = useMutation(markAllNotificationsReadMutationOptions)
  const queryClient = useQueryClient()

  const tagOptions = useMemo(() => {
    const tags = new Set<string>()
    for (const definition of Object.values(notificationDefinitions)) {
      for (const tag of definition.metadata.tags ?? []) {
        tags.add(tag)
      }
    }
    return Array.from(tags)
  }, [])

  const formatTagLabel = (tag: string) => {
    const preset: Record<string, string> = {
      expiry: 'Expiry',
      updates: 'ENS Updates',
      education: 'Education',
      onboarding: 'Onboarding',
      transfer: 'Transfers',
    }

    if (preset[tag]) return preset[tag]
    return tag
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  }

  const handleMarkAllAsRead = () => {
    const notificationsQueryData = queryClient.getQueryData(
      notificationsInfiniteQuery.queryKey,
    )

    const loadedNotifications =
      notificationsQueryData?.pages.flatMap((page) => page.notifications) ?? []

    markAllAsRead.mutate(loadedNotifications)
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-12 rounded-lg border-[#dededf] bg-white px-8 py-8 sm:px-6 lg:my-5 lg:border">
      <div className="mb-24 flex flex-col gap-8">
        <div className="flex justify-between">
          <div className="flex items-center gap-3">
            <div className="font-[350] text-[#232222] text-temp-32px leading-ens-none">
              <Trans>All Notifications</Trans>
            </div>
            <UnreadCount />
          </div>
          <Link
            className="group flex items-center gap-2"
            to="/notifications/settings"
          >
            <MSymbol className="ms-opsz-30 ms-wght-200" symbol="settings" />
            <div className="font-normal text-[#232222] text-base leading-ens-normal group-hover:underline max-sm:hidden">
              <Trans>Notification Settings</Trans>
            </div>
          </Link>
        </div>
        <div className="flex justify-between">
          <Field className="w-fit" orientation="horizontal">
            <Switch
              checked={unreadOnly}
              id="switch-disabled-unchecked"
              onCheckedChange={(checked) => setUnreadOnly(Boolean(checked))}
            />
            <FieldLabel
              className="font-normal"
              htmlFor="switch-disabled-unchecked"
            >
              <Trans>Unread only</Trans>
            </FieldLabel>
          </Field>

          <button
            className="font-normal text-base text-ens-lapis-core leading-ens-normal hover:underline"
            disabled={markAllAsRead.isPending}
            onClick={handleMarkAllAsRead}
            type="button"
          >
            {markAllAsRead.isPending ? (
              <Trans>Marking...</Trans>
            ) : (
              <Trans>Mark all as read</Trans>
            )}
          </button>
        </div>
        <InputGroup className="h-10 border-0 bg-[#FCFBFB]">
          <InputGroupInput
            aria-label={t`Search notifications`}
            placeholder={t`Search notifications`}
          />
          <InputGroupAddon>
            <MSymbol className="ms-opsz-24 ms-wght-200" symbol="search" />
          </InputGroupAddon>
        </InputGroup>
        <div className="-mx-8 overflow-x-auto px-8 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max gap-4">
            <FilterBadge
              active={selectedTag === 'all'}
              label="All"
              onClick={() => setSelectedTag('all')}
            />
            {tagOptions.map((tag) => (
              <FilterBadge
                active={selectedTag === tag}
                key={tag}
                label={formatTagLabel(tag)}
                onClick={() => setSelectedTag(tag)}
              />
            ))}
          </div>
        </div>
      </div>
      <NotificationsList selectedTag={selectedTag} unreadOnly={unreadOnly} />
    </div>
  )
}

export const Route = createFileRoute('/notifications/_authenticated/')({
  component: AllNotificationsPage,
})
