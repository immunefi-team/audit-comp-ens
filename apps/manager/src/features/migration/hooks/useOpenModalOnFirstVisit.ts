import { useSelector } from '@xstate/store-react'
import { useEffect, useState } from 'react'
import { backendAuthStore } from '@/utils/backend-client'

const STORAGE_KEY = 'migration-modal-dismissed'

export const useOpenModalOnFirstVisit = (
  isConnected: boolean,
  hasV1Names: boolean,
) => {
  const [open, setOpen] = useState(false)

  const isAuthResolved = useSelector(
    backendAuthStore,
    (state) => !!state.context.authKey || state.context.modalDismissed,
  )

  useEffect(() => {
    if (!isConnected || !hasV1Names || !isAuthResolved) return
    if (localStorage.getItem(STORAGE_KEY) === 'true') return
    localStorage.setItem(STORAGE_KEY, 'true')
    setOpen(true)
  }, [isConnected, hasV1Names, isAuthResolved])

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setOpen(false)
  }

  return { open, dismiss }
}
