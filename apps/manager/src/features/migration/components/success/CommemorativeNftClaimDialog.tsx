import type { Address } from 'viem'
import { useConnection } from 'wagmi'
import { useCommemorativeNftFlow } from '../../commemorative-nft/useCommemorativeNftFlow'
import { MigrationSuccessDialog } from '../MigrationSuccessDialog'

type CommemorativeNftClaimDialogProps = {
  readonly context: 'migration' | 'mint-later'
  readonly migratedNameCount?: number
  readonly onClose: () => void
  readonly onViewProfile: (profileName: string | undefined) => void
  readonly open: boolean
  readonly ownerAddress: Address | undefined
  readonly preview?: boolean
  readonly previewProfileName?: string
}

export const CommemorativeNftClaimDialog = ({
  context,
  migratedNameCount = 0,
  onClose,
  onViewProfile,
  open,
  ownerAddress,
  preview,
  previewProfileName,
}: CommemorativeNftClaimDialogProps) => {
  const { address: walletAddress } = useConnection()
  const flow = useCommemorativeNftFlow({
    open,
    ownerAddress,
    walletAddress,
    migratedNameCount,
    preview,
    previewProfileName,
  })

  return (
    <MigrationSuccessDialog
      canMint={flow.canMint}
      context={context}
      migratedNameCount={migratedNameCount}
      onClose={onClose}
      onMint={() => void flow.mint()}
      onRetry={() => void flow.retry()}
      onRevealComplete={flow.completeReveal}
      onViewProfile={() => onViewProfile(flow.eligibility?.profileName)}
      open={open}
      state={flow.state}
    />
  )
}
