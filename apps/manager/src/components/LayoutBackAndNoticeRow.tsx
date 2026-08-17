import {
  GlobalBackButton,
  useResolvedGlobalBackButtonConfig,
} from '@/components/GlobalBackButton'
import { SepoliaNoticeBanner } from '@/components/SepoliaNoticeBanner'
import { tw } from '@/utils/tailwind'

export const LayoutBackAndNoticeRow = ({
  isHidden = false,
  isSepoliaBannerVisible,
}: {
  readonly isHidden?: boolean
  readonly isSepoliaBannerVisible: boolean
}) => {
  const backButtonConfig = useResolvedGlobalBackButtonConfig()
  const isBackButtonVisible = Boolean(backButtonConfig?.isVisible)

  if (isHidden) {
    return null
  }

  if (!isBackButtonVisible && !isSepoliaBannerVisible) {
    return null
  }

  return (
    <div className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-4 py-3 md:grid-cols-[10rem_minmax(0,1fr)_10rem] md:gap-4 md:px-8">
      <div
        className={tw(
          'flex justify-start md:pl-3',
          !isBackButtonVisible && 'hidden md:block',
        )}
      >
        <GlobalBackButton />
      </div>
      {isSepoliaBannerVisible && (
        <SepoliaNoticeBanner
          className={tw(!isBackButtonVisible && 'col-span-2 md:col-span-1')}
        />
      )}
      <div aria-hidden className="hidden md:block" />
    </div>
  )
}
