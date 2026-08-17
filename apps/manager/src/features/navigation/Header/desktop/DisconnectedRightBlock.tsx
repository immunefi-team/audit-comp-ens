import { Trans } from '@lingui/react/macro'
import { useConnection } from 'wagmi'
import { Button } from '@/components/ens-consumer/button/Button'
import { MSymbol } from '@/components/ui/material-symbol'
import { useConnectModal } from '@/lib/wallet'
import { FloatingWrapper } from '../shared/FloatingWrapper'

export const DisconnectedRightBlock = () => {
  const { openConnectModal } = useConnectModal()
  const { isConnecting, isReconnecting } = useConnection()

  return (
    <FloatingWrapper>
      <Button
        color="blue"
        loading={isConnecting || isReconnecting}
        onClick={() => openConnectModal?.()}
        size="temp-xs"
      >
        <Trans>Connect</Trans>
        <MSymbol
          className="ms-opsz-20 ms-wght-400"
          data-icon="inline-end"
          symbol="login"
        />
      </Button>
    </FloatingWrapper>
  )
}
