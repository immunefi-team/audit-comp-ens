import { Trans } from '@lingui/react/macro'
import { useConnection } from 'wagmi'
import { Button } from '@/components/ens-consumer/button/Button'
import { useConnectModal } from '@/lib/wallet'

export const MobileConnectButton = () => {
  const { openConnectModal } = useConnectModal()
  const { isConnecting, isReconnecting } = useConnection()

  return (
    <Button
      color="blue"
      loading={isConnecting || isReconnecting}
      onClick={() => openConnectModal?.()}
      size="temp-xs"
    >
      <Trans>Connect</Trans>
    </Button>
  )
}
