import { createContext, type ReactNode, use } from 'react'

const ProfileThemeColorContext = createContext<string | undefined>(undefined)

type ProfileThemeColorProviderProps = {
  readonly children: ReactNode
  readonly value?: string
}

export const ProfileThemeColorProvider = ({
  children,
  value,
}: ProfileThemeColorProviderProps) => (
  <ProfileThemeColorContext.Provider value={value}>
    {children}
  </ProfileThemeColorContext.Provider>
)

export const useProfileThemeColor = () => use(ProfileThemeColorContext)
