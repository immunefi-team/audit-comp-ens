import { msg } from '@lingui/core/macro'

export const favoriteAuthPromptMessage = msg`Connect to favorite name`

type FavoriteActionIntentArgs = {
  readonly isAuthed: boolean
  readonly isFavorite: boolean
  readonly isPending: boolean
  readonly name: string
  readonly shouldPromptAuth: boolean
}

export type FavoriteActionIntent =
  | {
      readonly kind: 'addFavorite'
      readonly name: string
    }
  | {
      readonly kind: 'removeFavorite'
      readonly name: string
    }
  | {
      readonly kind: 'promptAuth'
    }
  | {
      readonly kind: 'none'
    }

export const getFavoriteActionIntent = ({
  isAuthed,
  isFavorite,
  isPending,
  name,
  shouldPromptAuth,
}: FavoriteActionIntentArgs): FavoriteActionIntent => {
  if (isPending) return { kind: 'none' }
  if (!isAuthed)
    return shouldPromptAuth ? { kind: 'promptAuth' } : { kind: 'none' }
  if (isFavorite) return { kind: 'removeFavorite', name }

  return { kind: 'addFavorite', name }
}

export const getFavoriteActionDisabled = ({
  isPending,
}: {
  readonly isPending: boolean
}) => isPending
