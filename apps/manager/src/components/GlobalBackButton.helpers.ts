export interface GlobalBackButtonConfig {
  readonly className?: string
  readonly fallbackPath?: '/' | '/dashboard'
  readonly isVisible: boolean
}

export const DEFAULT_GLOBAL_BACK_BUTTON_CONFIG = {
  fallbackPath: '/',
  isVisible: true,
} satisfies GlobalBackButtonConfig

const isProfileRoute = (pathname: string) =>
  /^\/[^/]+\.[^/]+\/?$/.test(pathname) ||
  /^\/0x[a-fA-F0-9]{40}\/?$/.test(pathname)

const globalBackButtonStaticRoutes: readonly string[] = [
  '/payment/add',
  '/payment/add/',
  '/payment/list',
  '/payment/list/',
  '/notifications',
  '/notifications/',
  '/notifications/settings',
  '/notifications/settings/',
  '/auto-renewal',
  '/auto-renewal/',
  '/wallet',
  '/wallet/',
]

export const getDefaultGlobalBackButtonConfig = (
  pathname: string,
): GlobalBackButtonConfig | null => {
  if (pathname.startsWith('/legal/')) {
    return DEFAULT_GLOBAL_BACK_BUTTON_CONFIG
  }

  if (isProfileRoute(pathname)) {
    return DEFAULT_GLOBAL_BACK_BUTTON_CONFIG
  }

  if (globalBackButtonStaticRoutes.includes(pathname)) {
    return DEFAULT_GLOBAL_BACK_BUTTON_CONFIG
  }

  return null
}

export const resolveGlobalBackButtonConfig = ({
  config,
  pathname,
}: {
  readonly config: GlobalBackButtonConfig | null
  readonly pathname: string
}): GlobalBackButtonConfig | null =>
  config ?? getDefaultGlobalBackButtonConfig(pathname)
