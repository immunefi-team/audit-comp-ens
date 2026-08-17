import { Trans } from '@lingui/react/macro'
import { useMemo, useState } from 'react'
import type { Address } from 'viem'
import { MSymbol } from '@/components/ui/material-symbol'
import { useSmartAccountContext } from '@/lib/smart-account'
import { buildCommemorativeNftCardData } from '../../commemorative-nft/cardData'
import { isCommemorativeNftCanonicalProfile } from '../../commemorative-nft/sharing'
import { useCommemorativeNftAvailability } from '../../commemorative-nft/useCommemorativeNftAvailability'
import { CommemorativeNftCard } from './CommemorativeNftCard'
import { CommemorativeNftClaimDialog } from './CommemorativeNftClaimDialog'

type CommemorativeNftProfileSectionProps = {
  readonly isOwner: boolean
  readonly name: string
}

export const CommemorativeNftProfileSection = ({
  isOwner,
  name,
}: CommemorativeNftProfileSectionProps) => {
  const { ownerAddress } = useSmartAccountContext()
  const [open, setOpen] = useState(false)
  const availability = useCommemorativeNftAvailability({
    ownerAddress: ownerAddress as Address | undefined,
    enabled: isOwner,
    allowDevFixture: true,
  })

  const eligibility =
    availability.eligibility.data?.status === 'eligible'
      ? availability.eligibility.data.eligibility
      : undefined
  const isCanonical = eligibility
    ? isCommemorativeNftCanonicalProfile(name, eligibility.profileName)
    : false
  const minted = availability.claimed.data === true
  const artworkUrl = eligibility?.assets.imageUrl
  const cardData = useMemo(
    () =>
      eligibility && minted
        ? buildCommemorativeNftCardData({
            artworkUrl,
            chainId: availability.chainId,
            eligibility,
            migratedAt: new Date(),
            migratedNameCount: 0,
            minted: true,
            ownerAddress: eligibility.ownerAddress,
          })
        : undefined,
    [artworkUrl, availability.chainId, eligibility, minted],
  )

  if (!isOwner || !eligibility || !isCanonical) return null

  return (
    <>
      <section className="border-[0.25px] border-transparent bg-transparent px-5 py-6 lg:landscape:px-8 lg:landscape:pt-8 lg:landscape:pb-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-sans text-base text-ens-quartz-900 leading-normal">
            <Trans>ENSv2 commemorative NFT</Trans>
          </h2>
          <span className="rounded-full bg-ens-pink/10 px-2.5 py-1 font-semi-mono text-[10px] text-ens-garnet-500 uppercase tracking-[0.12em]">
            {minted ? <Trans>Minted</Trans> : <Trans>Ready</Trans>}
          </span>
        </div>

        {cardData ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-ens-pink/15 bg-[linear-gradient(180deg,#fff5f8,#ffe6f0)] px-2 py-5">
            <CommemorativeNftCard
              state={{ status: 'minted', card: cardData }}
            />
          </div>
        ) : (
          <div className="relative mt-4 overflow-hidden rounded-xl border border-ens-pink/20 bg-[linear-gradient(110deg,#fff5f8,#ffe0ec)] p-5">
            <div className="absolute -top-10 -right-8 size-28 rounded-full bg-white/50 blur-2xl" />
            <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/75 text-ens-garnet-500">
                  <MSymbol className="text-[22px]" symbol="auto_awesome" />
                </div>
                <p className="max-w-md font-sans text-ens-garnet-700 text-sm leading-relaxed">
                  <Trans>
                    Your card is ready to preview. Minting is optional and you
                    pay the network gas.
                  </Trans>
                </p>
              </div>
              <button
                className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xs bg-ens-garnet-900 px-4 font-semi-mono text-ens-garnet-50 text-xs uppercase tracking-[0.1em]"
                onClick={() => setOpen(true)}
                type="button"
              >
                <Trans>Preview and mint</Trans>
                <MSymbol className="text-[18px]" symbol="arrow_forward" />
              </button>
            </div>
          </div>
        )}
      </section>

      <CommemorativeNftClaimDialog
        context="mint-later"
        onClose={() => setOpen(false)}
        onViewProfile={() => setOpen(false)}
        open={open}
        ownerAddress={ownerAddress as Address | undefined}
      />
    </>
  )
}
