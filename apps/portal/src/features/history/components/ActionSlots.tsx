import { useEffect, useRef, useState } from 'react'
import { match } from 'ts-pattern'
import type { Address, Hex } from 'viem'
import { EntityBadge } from '@/components/EntityBadge'
import { truncateAddress } from '@/utils/formatting/truncateAddress'
import type { ActionSlot } from '../summarize/summarize.types'
import { AccountBadge } from './AccountBadge'
import { ContractBadge } from './ContractBadge'

/**
 * Actor slots sit on always-visible tier-1 rows, so their tx-sender + reverse
 * lookups would all fire on page load. Defer each until its row scrolls near the
 * viewport. Falls back to eager where IntersectionObserver is absent (SSR/tests).
 */
const ActorSlot = ({ address, txHash }: { address?: Address; txHash: Hex }) => {
  const ref = useRef<HTMLSpanElement>(null)
  const [inView, setInView] = useState(
    typeof IntersectionObserver === 'undefined',
  )

  useEffect(() => {
    if (inView) return
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [inView])

  return (
    <span ref={ref} className="inline-flex">
      <AccountBadge address={address} txHash={txHash} enabled={inView} />
    </span>
  )
}

/** Renders one label slot — an entity chip, a monospace value, or a muted joiner. */
const Slot = ({ slot }: { slot: ActionSlot }) =>
  match(slot)
    .with({ kind: 'name' }, ({ value }) => (
      <EntityBadge variant="name" name={value} compact>
        {value}
      </EntityBadge>
    ))
    .with({ kind: 'address' }, ({ value }) => (
      <EntityBadge variant="address" address={value} compact>
        {truncateAddress(value)}
      </EntityBadge>
    ))
    .with({ kind: 'actor' }, ({ address, txHash }) => (
      <ActorSlot address={address} txHash={txHash} />
    ))
    .with({ kind: 'contract' }, ({ value, isRegistry, label }) => (
      <ContractBadge address={value} isRegistry={isRegistry} label={label} />
    ))
    .with({ kind: 'text' }, ({ value }) => (
      <code className="inline-block max-w-60 truncate rounded bg-neutral-1 px-1.5 py-0.5 align-bottom font-mono text-p text-neutral-7">
        {value}
      </code>
    ))
    .with({ kind: 'glyph' }, ({ value }) => (
      <span className="text-muted-foreground">{value}</span>
    ))
    .with({ kind: 'connective' }, ({ value }) => (
      <span className="-ml-2 text-muted-foreground text-p">{value}</span>
    ))
    .with({ kind: 'placeholder' }, ({ value }) => (
      <span className="rounded border border-dashed px-1.5 py-0.5 text-muted-foreground text-p">
        {value}
      </span>
    ))
    .exhaustive()

export const ActionSlots = ({ slots }: { slots: readonly ActionSlot[] }) => (
  <>
    {slots.map((slot, index) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: slots are a positional, static label sequence
      <Slot key={`${slot.kind}-${index}`} slot={slot} />
    ))}
  </>
)
