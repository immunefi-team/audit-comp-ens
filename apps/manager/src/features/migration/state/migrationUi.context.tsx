import { useActorRef, useSelector } from '@xstate/react'
import { createContext, use, useEffect } from 'react'
import { useConfig } from 'wagmi'
import type { Actor } from 'xstate'
import {
  type MigrationUiSnapshot,
  migrationUiMachine,
} from './migrationUi.machine'

const MigrationUiContext = createContext<{
  uiActor: Actor<typeof migrationUiMachine>
} | null>(null)

export const MigrationUiProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const wagmiConfig = useConfig()
  const uiActor = useActorRef(migrationUiMachine, {
    input: { wagmiConfig },
  })

  useEffect(() => {
    const subscription = uiActor.subscribe({
      error: (error) => {
        console.error('Migration UI error:', error)
      },
    })

    return subscription.unsubscribe
  }, [uiActor])

  return (
    <MigrationUiContext.Provider value={{ uiActor }}>
      {children}
    </MigrationUiContext.Provider>
  )
}

export const useMigrationUiContext = () => {
  const context = use(MigrationUiContext)
  if (!context) {
    throw new Error('You used a hook outside of the MigrationUiProvider')
  }
  return context
}

export const createMigrationUiSelector =
  <T,>(
    selector: (snapshot: MigrationUiSnapshot) => T,
    compare?: (a: T, b: T) => boolean,
  ) =>
  (uiActor: Actor<typeof migrationUiMachine>) =>
    useSelector(uiActor, selector, compare)
