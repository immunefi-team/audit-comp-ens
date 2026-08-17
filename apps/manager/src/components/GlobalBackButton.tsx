import { Trans } from '@lingui/react/macro'
import { useCanGoBack, useLocation, useNavigate } from '@tanstack/react-router'
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { MSymbol } from '@/components/ui/material-symbol'
import { twm } from '@/utils/tailwind'
import {
  type GlobalBackButtonConfig,
  resolveGlobalBackButtonConfig,
} from './GlobalBackButton.helpers'

interface GlobalBackButtonContextValue {
  readonly backButtonConfig: GlobalBackButtonConfig | null
  readonly setBackButtonConfig: Dispatch<
    SetStateAction<GlobalBackButtonConfig | null>
  >
}

const GlobalBackButtonContext =
  createContext<GlobalBackButtonContextValue | null>(null)

const useGlobalBackButtonContext = () => {
  const context = useContext(GlobalBackButtonContext)

  if (!context) {
    throw new Error(
      'Global back button must be used within GlobalBackButtonProvider',
    )
  }

  return context
}

export const GlobalBackButtonProvider = ({
  children,
}: {
  children: ReactNode
}) => {
  const [backButtonConfig, setBackButtonConfig] =
    useState<GlobalBackButtonConfig | null>(null)

  const value = useMemo(
    () => ({
      backButtonConfig,
      setBackButtonConfig,
    }),
    [backButtonConfig],
  )

  return (
    <GlobalBackButtonContext.Provider value={value}>
      {children}
    </GlobalBackButtonContext.Provider>
  )
}

export const useGlobalBackButton = (config: GlobalBackButtonConfig | null) => {
  const { setBackButtonConfig } = useGlobalBackButtonContext()
  const hasConfig = config !== null
  const className = config?.className
  const fallbackPath = config?.fallbackPath ?? '/'
  const isVisible = config?.isVisible ?? false

  useEffect(() => {
    const clearBackButtonConfig = () => setBackButtonConfig(null)

    if (!hasConfig) {
      clearBackButtonConfig()
      return clearBackButtonConfig
    }

    setBackButtonConfig(
      isVisible
        ? {
            className,
            fallbackPath,
            isVisible: true,
          }
        : { isVisible: false },
    )

    return clearBackButtonConfig
  }, [className, fallbackPath, hasConfig, isVisible, setBackButtonConfig])
}

export const useResolvedGlobalBackButtonConfig = () => {
  const { backButtonConfig } = useGlobalBackButtonContext()
  const { pathname } = useLocation()

  return resolveGlobalBackButtonConfig({ config: backButtonConfig, pathname })
}

export const GlobalBackButton = () => {
  const config = useResolvedGlobalBackButtonConfig()
  const canGoBack = useCanGoBack()
  const navigate = useNavigate()

  if (!config?.isVisible) {
    return null
  }

  const handleBack = () => {
    if (canGoBack) {
      window.history.back()
      return
    }

    navigate({ to: config.fallbackPath ?? '/' })
  }

  return (
    <button
      aria-label="Back"
      className={twm(
        'inline-flex items-center gap-2 py-2 font-medium text-ens-lapis-core text-sm uppercase leading-ens-none transition-colors hover:text-ens-lapis-core/80',
        config.className,
      )}
      onClick={handleBack}
      type="button"
    >
      <MSymbol className="ms-opsz-24 ms-wght-500" symbol="arrow_back" />
      <span className="max-xl:hidden">
        <Trans>Back</Trans>
      </span>
    </button>
  )
}
