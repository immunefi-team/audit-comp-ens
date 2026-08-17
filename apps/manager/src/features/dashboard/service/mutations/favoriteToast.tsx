import { i18n } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { toast } from 'sonner'
import { MSymbol } from '@/components/ui/material-symbol'

const favoriteAddedToastMessage = msg`Added to your favorites!`

const getFavoriteAddedToastCopy = () =>
  i18n.locale
    ? i18n._(favoriteAddedToastMessage)
    : favoriteAddedToastMessage.message

const favoriteToastIconClassName =
  'ms-fill ms-opsz-24 ms-wght-400 size-6 shrink-0 text-2xl leading-none'

export const showFavoriteAddedToast = () => {
  const message = getFavoriteAddedToastCopy()

  toast(message, {
    icon: (
      <MSymbol
        aria-hidden="true"
        className={favoriteToastIconClassName}
        symbol="favorite"
      />
    ),
    id: 'favorite-added-toast',
    position: 'bottom-right',
  })
}
