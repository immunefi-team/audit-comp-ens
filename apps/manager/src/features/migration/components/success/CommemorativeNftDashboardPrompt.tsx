import { Trans } from '@lingui/react/macro'
import { useNavigate } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { useState } from 'react'
import type { Address } from 'viem'
import { MSymbol } from '@/components/ui/material-symbol'
import { useSmartAccountContext } from '@/lib/smart-account'
import { useCommemorativeNftAvailability } from '../../commemorative-nft/useCommemorativeNftAvailability'
import { CommemorativeNftClaimDialog } from './CommemorativeNftClaimDialog'

export const CommemorativeNftDashboardPrompt = () => {
  const navigate = useNavigate()
  const { ownerAddress } = useSmartAccountContext()
  const [open, setOpen] = useState(false)
  const availability = useCommemorativeNftAvailability({
    ownerAddress: ownerAddress as Address | undefined,
    enabled: true,
    allowDevFixture: true,
  })

  const eligibility =
    availability.eligibility.data?.status === 'eligible'
      ? availability.eligibility.data.eligibility
      : undefined
  const shouldShow = !!eligibility && availability.claimed.data === false

  if (!shouldShow) return null

  return (
    <>
      <motion.section
        animate={{ opacity: 1, y: 0 }}
        className="relative mx-4 overflow-hidden rounded-xl border border-ens-pink/25 bg-[linear-gradient(108deg,#fff4f8_0%,#ffe1ed_58%,#ffd2e7_100%)] px-5 py-5 shadow-[0_8px_30px_rgba(128,0,54,0.06)] md:mx-0 md:px-6"
        initial={{ opacity: 0, y: 8 }}
      >
        <div className="absolute -top-14 -right-10 size-40 rounded-full bg-white/45 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-white/70 text-ens-garnet-500">
              <MSymbol className="text-[22px]" symbol="auto_awesome" />
            </div>
            <div>
              <h2 className="font-sans text-ens-garnet-900 text-lg leading-tight">
                <Trans>Your ENSv2 commemorative NFT is ready</Trans>
              </h2>
              <p className="mt-1 max-w-xl font-sans text-ens-garnet-500 text-sm leading-relaxed">
                <Trans>
                  Preview your one-of-a-kind card and mint it whenever
                  you&apos;re ready.
                </Trans>
              </p>
            </div>
          </div>
          <button
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xs bg-ens-garnet-900 px-4 font-semi-mono text-ens-garnet-50 text-xs uppercase tracking-[0.1em] transition hover:bg-ens-garnet-800"
            onClick={() => setOpen(true)}
            type="button"
          >
            <Trans>View and mint</Trans>
            <MSymbol className="text-[18px]" symbol="arrow_forward" />
          </button>
        </div>
      </motion.section>

      <CommemorativeNftClaimDialog
        context="mint-later"
        onClose={() => setOpen(false)}
        onViewProfile={(profileName) => {
          setOpen(false)
          navigate({
            to: '/$name',
            params: { name: profileName ?? eligibility.profileName },
          })
        }}
        open={open}
        ownerAddress={ownerAddress as Address | undefined}
      />
    </>
  )
}
