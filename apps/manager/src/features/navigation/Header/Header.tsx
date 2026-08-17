import { useMediaQuery } from '@ens-apps/utils/useMediaQuery'
import { useHydrated } from '@tanstack/react-router'
import { useConnection } from 'wagmi'
import { DesktopHeader } from './desktop/Desktop'
import { MobileHeader } from './mobile/MobileHeader'

type HeaderProps = {
  readonly desktopBreakpoint?: 'md' | 'lg-landscape'
  readonly hasMobileBlurredBackground?: boolean
  readonly profileThemeColor?: string
  readonly transparentBackground?: boolean
}

export const Header = ({
  desktopBreakpoint = 'md',
  hasMobileBlurredBackground = false,
  profileThemeColor,
  transparentBackground = false,
}: HeaderProps) => {
  const isDesktop = useMediaQuery(
    desktopBreakpoint === 'lg-landscape'
      ? '(min-width: 1024px) and (orientation: landscape)'
      : '(min-width: 768px)',
  )
  const isHydrated = useHydrated()
  const { isConnected, isConnecting, isReconnecting } = useConnection()

  // Show a loading placeholder (not "Connect") until hydrated and nothing is
  // mid-connect, so the slot doesn't flash during reconnection.
  const connectionSettled = isHydrated && !isConnecting && !isReconnecting

  // Default to desktop until hydrated: useMediaQuery is false on the server /
  // first client render, which would flash the mobile header before hydration.
  const showMobileHeader = isHydrated && !isDesktop

  if (showMobileHeader) {
    return (
      <MobileHeader
        connectionSettled={connectionSettled}
        hasBlurredBackground={hasMobileBlurredBackground}
        isConnected={isConnected}
        transparentBackground={transparentBackground}
      />
    )
  }

  return (
    <DesktopHeader
      connectionSettled={connectionSettled}
      isConnected={isConnected}
      profileThemeColor={profileThemeColor}
      transparentBackground={transparentBackground}
    />
  )
}
