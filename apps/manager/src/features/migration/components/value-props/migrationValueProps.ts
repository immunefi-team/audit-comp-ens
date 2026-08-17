import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { isFeatureEnabled } from '@/utils/feature-flags'
import customProfiles from './assets/custom-profiles.webp'
import everythingOnePlace from './assets/everything-one-place.webp'
import favoritesAnimation from './assets/favorites.webm'
import favoritesPoster from './assets/favorites.webp'
import notificationsAnimation from './assets/notifications.webm'
import notificationsPoster from './assets/notifications.webp'
import personalizedNft from './assets/personalized-nft.webp'
import type { MigrationValuePropMedia } from './MigrationValuePropMediaCard'

export type MigrationValuePropSlide = {
  readonly id: 'profiles' | 'favorites' | 'notifications' | 'experience' | 'nft'
  readonly label: MessageDescriptor
  readonly media: MigrationValuePropMedia
}

const ALL_SLIDES: readonly MigrationValuePropSlide[] = [
  {
    id: 'profiles',
    label: msg`Custom profiles`,
    media: {
      alt: 'Custom profiles card',
      src: customProfiles,
      type: 'image',
    },
  },
  {
    id: 'favorites',
    label: msg`Track your favorite names`,
    media: {
      alt: 'Track your favorite names animation',
      src: favoritesAnimation,
      type: 'video',
      poster: favoritesPoster,
    },
  },
  {
    id: 'notifications',
    label: msg`Keep your names safe with notifications`,
    media: {
      alt: 'Notifications animation',
      src: notificationsAnimation,
      type: 'video',
      poster: notificationsPoster,
    },
  },
  {
    id: 'experience',
    label: msg`Manage everything in one place`,
    media: {
      alt: 'Manage everything in one place card',
      src: everythingOnePlace,
      type: 'image',
    },
  },
  {
    id: 'nft',
    label: msg`Personalized NFT`,
    media: {
      alt: 'Personalized NFT card',
      src: personalizedNft,
      type: 'image',
    },
  },
] as const

export const MIGRATION_VALUE_PROP_SLIDES: readonly MigrationValuePropSlide[] =
  ALL_SLIDES.filter(
    (slide) => slide.id !== 'nft' || isFeatureEnabled('COMMEMORATIVE_NFT_COPY'),
  )
