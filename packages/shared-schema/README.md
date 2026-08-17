# @ens-apps/shared-schema

Runtime shared schemas, constants, and derived types used by both manager and api-worker.

## Modules

- `@ens-apps/shared-schema/notifications`
- `@ens-apps/shared-schema/telegram`

## Purpose

- One canonical runtime source for notification kinds and payload schemas
- Shared notification definitions for frontend/backend consumption
- Shared telegram auth schema/type

## Notifications Glossary

- Notification: umbrella term for all notification kinds.
- Personal notification: user-specific notification records.
- Broadcast notification: system-wide announcement records.

## Channel Definitions

`@ens-apps/shared-schema/notifications` exports:

- `ChannelType`
- `channelDefinitions`

Channel definitions are intentionally minimal runtime metadata:

- `label`
- `requiresVerification`

## Authoring Notifications

Each kind is defined in a single file under:

- `src/notifications/kinds/*.ts`

A kind definition contains:

- `kind`
- `source`
- `payloadSchema`
- `metadata`
- `delivery`

Kinds are registered in `src/notifications/kinds/index.ts`.
