import { useCustomConnectModal } from './stacks/custom/ConnectModalProvider'

// The app's connect entry point. When the vendor changes, swap the body for the
// new vendor's login hook — the { openConnectModal, connectModalOpen } shape (and
// every call site) stays the same.
export const useConnectModal = () => {
  const { openConnectModal, connectModalOpen } = useCustomConnectModal()
  return { openConnectModal, connectModalOpen }
}
