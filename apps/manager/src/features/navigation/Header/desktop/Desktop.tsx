import { tw } from '@/utils/tailwind'
import { DesktopAccountSection } from '../account/DesktopAccountSection'
import { DesktopNavigation } from '../navigation/DesktopNavigation'
import { DesktopSearch } from '../search/DesktopSearch'
import { FloatingWrapper } from '../shared/FloatingWrapper'
import { DisconnectedRightBlock } from './DisconnectedRightBlock'

type DesktopHeaderProps = {
  readonly isConnected: boolean
  readonly connectionSettled: boolean
  readonly profileThemeColor?: string
  readonly transparentBackground?: boolean
}

export const DesktopHeader = ({
  isConnected,
  connectionSettled,
  profileThemeColor,
  transparentBackground = false,
}: DesktopHeaderProps) => {
  return (
    <nav
      className={tw(
        'sticky top-0 z-10 flex h-[54px] min-w-0 items-center justify-between gap-2 px-4 py-2 md:h-20 md:px-8 md:py-1.5',
        transparentBackground && 'md:px-[30px]',
      )}
    >
      <FloatingWrapper className="w-full max-w-xl">
        <DesktopNavigation
          profileHeader={transparentBackground}
          profileThemeColor={profileThemeColor}
        />
        <DesktopSearch />
      </FloatingWrapper>
      {connectionSettled ? (
        isConnected ? (
          <DesktopAccountSection />
        ) : (
          <DisconnectedRightBlock />
        )
      ) : (
        // Placeholder reserving the connect/account slot until the wallet
        // connection settles — avoids the Connect → account flash on load.
        <div
          aria-hidden
          className="h-9 w-28 animate-pulse rounded-full bg-ens-gray-two/60"
        />
      )}
    </nav>
  )
}
