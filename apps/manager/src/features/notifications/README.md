# Notifications Feature

## Overview

Notifications are organized by product surface and kind-local rendering.

- `@ens-apps/shared-schema/notifications` owns runtime notification definitions:
  - kind identity
  - payload schemas
  - metadata
  - delivery policy
- Manager owns notification rendering and UX behavior.

Each manager notification kind lives in one file under `notifications/` and defines:

- payload validation for that kind
- render component for that kind

Invalid payloads and unknown kinds are dropped from UI.

## Glossary

- Notification: umbrella term for all notification kinds.
- Personal notification: user-specific notifications shown in dashboard/nav.
- Broadcast notification: system-wide notifications shown for all users.

## Folder Structure

- `notifications/`
- one module per notification kind + registry

- `inbox/`
- notifications page item/list UI

- `dropdown/`
- navbar dropdown UI

- `settings/`
- contact methods and preferences UI

- `data/`
- queries and data selectors

- `shared/`
- shared templates and primitives

- `types/`
- settings/contact method UI types

- `utils/`
- formatting/grouping/telegram helpers

## Add A New Notification Kind

1. Add shared runtime definition
- file: `packages/shared-schema/src/notifications/kinds/<kind>.ts`
- include `kind`, `source`, `payloadSchema`, `metadata`, `delivery`

2. Add manager renderer module
- file: `apps/manager/src/features/notifications/notifications/<kind>.tsx`
- export kind definition with payload guard and component

3. Register the kind
- file: `apps/manager/src/features/notifications/notifications/index.ts`

4. Add tests
- add/extend kind registry and UI tests

## Rendering Contract

- payload and kind validation happens in query select (`selectValidNotifications`)
- `NotificationItem` renders known kinds without re-validating payload on each render
- invalid payloads and unknown kinds are filtered before reaching list/dropdown UIs

## Testing Checklist

- kind registry covers all backend kinds
- invalid payloads/unknown kinds are filtered
- dropdown and inbox states remain correct
- settings and channel mutations still invalidate queries correctly
