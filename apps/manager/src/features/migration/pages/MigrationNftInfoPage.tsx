import { Trans } from '@lingui/react/macro'
import { Link } from '@tanstack/react-router'
import { motion, useReducedMotion } from 'motion/react'
import { MSymbol } from '@/components/ui/material-symbol'
import { GrainOverlay } from '../components/GrainOverlay'

const facts = [
  {
    icon: 'calendar_month',
    title: <Trans>Frozen June 1 snapshot</Trans>,
    body: (
      <Trans>
        Eligibility comes from a fixed snapshot of ENS holders. Names acquired
        after the snapshot do not change eligibility.
      </Trans>
    ),
  },
  {
    icon: 'fingerprint',
    title: <Trans>One NFT per address</Trans>,
    body: (
      <Trans>
        The token is tied to your eligible EOA. Migrating more names later does
        not create another commemorative NFT.
      </Trans>
    ),
  },
  {
    icon: 'auto_awesome',
    title: <Trans>Offered after your first migration</Trans>,
    body: (
      <Trans>
        You can preview the card after migrating one name, mint immediately, or
        return from your Dashboard or canonical profile later.
      </Trans>
    ),
  },
] as const

export const MigrationNftInfoPage = () => {
  const shouldReduceMotion = useReducedMotion()

  return (
    <main className="relative min-h-[calc(100dvh-80px)] overflow-hidden bg-[linear-gradient(145deg,#fff7fa_0%,#fee6ef_48%,#ffd4e6_100%)] px-4 py-10 text-ens-garnet-900 md:py-16">
      <GrainOverlay className="opacity-35" />
      <div className="absolute -top-44 -left-24 size-120 rounded-full bg-white/50 blur-3xl" />
      <div className="absolute -right-48 -bottom-64 size-150 rounded-full bg-[#ff8fbd]/25 blur-3xl" />

      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 mx-auto flex w-full max-w-4xl flex-col gap-10"
        initial={shouldReduceMotion ? undefined : { opacity: 0, y: 18 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        <Link
          className="inline-flex w-fit items-center gap-2 font-semi-mono text-ens-garnet-500 text-xs uppercase tracking-[0.12em] transition-opacity hover:opacity-65"
          to="/dashboard"
        >
          <MSymbol className="text-[19px]" symbol="arrow_back" />
          <Trans>Back to Dashboard</Trans>
        </Link>

        <header className="max-w-3xl space-y-5">
          <span className="inline-flex rounded-full border border-ens-pink/25 bg-white/45 px-3 py-1.5 font-semi-mono text-[11px] text-ens-garnet-500 uppercase tracking-[0.14em]">
            <Trans>ENSv2 commemorative NFT</Trans>
          </span>
          <h1 className="max-w-2xl font-sans text-[46px] leading-[0.98] tracking-[-0.04em] md:text-[68px]">
            <Trans>A marker for the move to a new era of ENS.</Trans>
          </h1>
          <p className="max-w-2xl font-sans text-ens-garnet-500 text-lg leading-relaxed md:text-xl">
            <Trans>
              The commemorative NFT is optional, one-of-a-kind generative art
              for addresses included in the ENS holder snapshot.
            </Trans>
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {facts.map((fact, index) => (
            <motion.article
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-white/60 bg-white/55 p-6 shadow-[0_12px_42px_rgba(93,0,39,0.07)] backdrop-blur-sm"
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: 14 }}
              key={fact.icon}
              transition={{
                delay: shouldReduceMotion ? 0 : 0.12 + index * 0.08,
                duration: 0.45,
              }}
            >
              <div className="mb-8 flex size-11 items-center justify-center rounded-full bg-ens-pink/10 text-ens-garnet-500">
                <MSymbol className="text-[23px]" symbol={fact.icon} />
              </div>
              <h2 className="font-sans text-xl leading-tight">{fact.title}</h2>
              <p className="mt-3 font-sans text-ens-garnet-500 text-sm leading-relaxed">
                {fact.body}
              </p>
            </motion.article>
          ))}
        </section>

        <section className="flex flex-col gap-5 border-ens-garnet-900/10 border-t pt-8 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl space-y-2">
            <h2 className="font-sans text-2xl">
              <Trans>Why might I be ineligible?</Trans>
            </h2>
            <p className="font-sans text-ens-garnet-500 text-sm leading-relaxed">
              <Trans>
                The contract checks membership in the June 1 address snapshot,
                not the names currently in your wallet. A later transfer or a
                different connected EOA does not alter that frozen list.
              </Trans>
            </p>
          </div>
          <Link
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xs bg-ens-garnet-900 px-5 font-semi-mono text-ens-garnet-50 text-xs uppercase tracking-[0.12em]"
            to="/dashboard"
          >
            <Trans>Open Dashboard</Trans>
            <MSymbol className="text-[19px]" symbol="arrow_forward" />
          </Link>
        </section>
      </motion.div>
    </main>
  )
}
