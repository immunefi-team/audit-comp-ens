/**
 * DEV-only floating panel for manual time travel against the local Anvil fork.
 *
 * Advances chain time (`evm_increaseTime` + `evm_mine`) AND the browser clock
 * (via the installed chain clock) together, then reloads so cached on-chain
 * reads (e.g. premium price from `getRegisterPrice`) refetch. Rendered only
 * when `isTimeTravelEnabled()` — mounted by each app's root route.
 */

import { increaseTime } from '@ens-apps/utils/time-travel/anvilTime'
import { getChainClock } from '@ens-apps/utils/time-travel/installChainClock'
import { type CSSProperties, useCallback, useState } from 'react'
import { TIME_TRAVEL_RPC } from './config'
import {
  DAY,
  formatDateTime,
  formatOffset,
  HOUR,
} from './TimeTravelPanel.helpers'
import {
  useAnvilBlockMs,
  useDraggablePanel,
  useFirstRunChainSync,
  useWarpedNow,
} from './TimeTravelPanel.hooks'

const STEPS: { label: string; seconds: number }[] = [
  { label: '+1h', seconds: HOUR },
  { label: '+1d', seconds: DAY },
  { label: '+7d', seconds: 7 * DAY },
  { label: '+30d', seconds: 30 * DAY },
  { label: '+90d', seconds: 90 * DAY },
  { label: '+1y', seconds: 365 * DAY },
]

/** MIN_COMMITMENT_AGE (60s on the v2 ETHRegistrar) + a small buffer. */
const COMMIT_SKIP_SECONDS = 70

// --- components -------------------------------------------------------------

/** Inner UI — time display, advance buttons, skip-commit. No wrapper or positioning. */
export function TimeTravelPanelContent() {
  const endpoint = TIME_TRAVEL_RPC
  const warpedNow = useWarpedNow()
  const { blockMs, error: blockError } = useAnvilBlockMs(endpoint)
  useFirstRunChainSync(endpoint)

  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [customDays, setCustomDays] = useState('30')

  const runAndReload = useCallback(async (op: () => Promise<void>) => {
    setBusy(true)
    setActionError(null)
    try {
      await op()
      window.location.reload()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }, [])

  const advanceSeconds = useCallback(
    (seconds: number) =>
      runAndReload(async () => {
        await increaseTime(seconds, endpoint)
        await getChainClock()?.syncFromChain(endpoint)
      }),
    [runAndReload],
  )

  const syncToChain = useCallback(
    () =>
      runAndReload(async () => {
        await getChainClock()?.syncFromChain(endpoint)
      }),
    [runAndReload],
  )

  const resetToRealTime = useCallback(
    () =>
      runAndReload(async () => {
        getChainClock()?.clearOffset()
      }),
    [runAndReload],
  )

  const advanceCustom = useCallback(() => {
    const days = Number.parseFloat(customDays)
    if (!Number.isFinite(days) || days <= 0) {
      setActionError('Enter a positive number of days')
      return
    }
    advanceSeconds(Math.round(days * DAY))
  }, [customDays, advanceSeconds])

  const skipCommitWait = useCallback(async () => {
    setBusy(true)
    setActionError(null)
    try {
      await increaseTime(COMMIT_SKIP_SECONDS, endpoint)
      await getChainClock()?.syncFromChain(endpoint)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [])

  const error = actionError ?? blockError

  return (
    <div style={columnStyle}>
      {/* Row 1: dates + offset */}
      <div style={rowStyle}>
        <span style={statLabelStyle}>⏱</span>
        <span>{formatDateTime(warpedNow || null)}</span>
        <span style={sepStyle} />
        <span style={statLabelStyle}>Block</span>
        <span>{formatDateTime(blockMs)}</span>
        <span style={sepStyle} />
        <span style={statLabelStyle}>Δ</span>
        <span>{formatOffset(getChainClock()?.getOffsetMs() ?? 0)}</span>
      </div>

      {/* Row 2: step buttons */}
      <div style={rowStyle}>
        {STEPS.map((step) => (
          <button
            key={step.label}
            type="button"
            disabled={busy}
            onClick={() => advanceSeconds(step.seconds)}
            style={chipStyle(busy)}
          >
            {step.label}
          </button>
        ))}
      </div>

      {/* Row 3: custom advance + sync / skip */}
      <div style={rowStyle}>
        <input
          type="number"
          min="0"
          step="0.5"
          value={customDays}
          onChange={(e) => setCustomDays(e.target.value)}
          disabled={busy}
          style={inputStyle}
          aria-label="Days to advance"
        />
        <button
          type="button"
          disabled={busy}
          onClick={advanceCustom}
          style={chipStyle(busy)}
        >
          Advance
        </button>
        <span style={sepStyle} />
        <button
          type="button"
          disabled={busy}
          onClick={syncToChain}
          style={dimStyle(busy)}
          title="Sync browser clock to chain"
        >
          Sync
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={resetToRealTime}
          style={dimStyle(busy)}
          title="Reset to real time"
        >
          Real time
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={skipCommitWait}
          style={dimStyle(busy)}
          title="Advance ~70s (MIN_COMMITMENT_AGE) — no reload"
        >
          Skip+{COMMIT_SKIP_SECONDS}s
        </button>
      </div>

      {error ? <span style={errorInlineStyle}>{error}</span> : null}
    </div>
  )
}

/** Standalone floating draggable panel — wraps TimeTravelPanelContent. */
export function TimeTravelPanel() {
  const { setNodeRef, dragHandlers, positionStyle } = useDraggablePanel()
  const [collapsed, setCollapsed] = useState(false)

  if (collapsed) {
    return (
      <button
        ref={setNodeRef}
        type="button"
        onClick={() => setCollapsed(false)}
        style={{ ...collapsedStyle, ...positionStyle }}
        title="Open Time Travel panel"
      >
        {'⏱'} Time Travel
      </button>
    )
  }

  return (
    <div ref={setNodeRef} style={{ ...panelStyle, ...positionStyle }}>
      <div
        style={{ ...headerStyle, cursor: 'move', touchAction: 'none' }}
        {...dragHandlers}
      >
        <span style={{ fontWeight: 600 }}>{'⏱'} Time Travel (dev)</span>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          onPointerDown={(e) => e.stopPropagation()}
          style={iconButtonStyle}
          title="Collapse"
        >
          {'✕'}
        </button>
      </div>
      <TimeTravelPanelContent />
    </div>
  )
}

// --- styles -----------------------------------------------------------------
//
// Inline CSSProperties instead of Tailwind (a deliberate styleguide exception).
// This is a self-contained dev widget injected into multiple apps; it must not
// depend on any host app's Tailwind setup. Both consumers are on Tailwind v4,
// whose source detection scans each app's own directory and skips node_modules,
// so utility classes from this workspace package would never be generated unless
// every consumer added an explicit `@source` for it. Inline styles guarantee the
// panel looks identical in any host. DEV-only.

const panelStyle: CSSProperties = {
  position: 'fixed',
  bottom: 12,
  left: 12,
  zIndex: 2_147_483_000,
  // Radix modal dialogs set `body { pointer-events: none }` while open, which
  // this fixed panel would inherit — visible but unclickable. Opt back in.
  pointerEvents: 'auto',
  width: 248,
  padding: 12,
  borderRadius: 10,
  background: 'rgba(17, 24, 39, 0.96)',
  color: '#e5e7eb',
  font: '12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace',
  boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
  border: '1px solid rgba(255,255,255,0.08)',
}

const collapsedStyle: CSSProperties = {
  position: 'fixed',
  bottom: 12,
  left: 12,
  zIndex: 2_147_483_000,
  pointerEvents: 'auto', // see panelStyle
  padding: '6px 10px',
  borderRadius: 8,
  background: 'rgba(17, 24, 39, 0.96)',
  color: '#e5e7eb',
  font: '12px/1 ui-monospace, SFMono-Regular, Menlo, monospace',
  border: '1px solid rgba(255,255,255,0.08)',
  cursor: 'pointer',
}

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 8,
}

const iconButtonStyle: CSSProperties = {
  padding: '2px 6px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'transparent',
  color: '#e5e7eb',
  cursor: 'pointer',
}

const columnStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  flexWrap: 'nowrap',
}

const sepStyle: CSSProperties = {
  width: 1,
  height: 13,
  background: '#d9d9d9',
  flexShrink: 0,
  alignSelf: 'center',
  margin: '0 3px',
}

const statLabelStyle: CSSProperties = { color: '#737373', fontSize: 11 }

function chipStyle(disabled: boolean): CSSProperties {
  return {
    padding: '2px 8px',
    borderRadius: 4,
    border: '1px solid #cee1e8',
    background: disabled ? '#eeeded' : '#0080bc',
    color: disabled ? '#737373' : '#ffffff',
    cursor: disabled ? 'default' : 'pointer',
    fontSize: 11,
    whiteSpace: 'nowrap',
    lineHeight: '1.2',
  }
}

function dimStyle(disabled: boolean): CSSProperties {
  return {
    padding: '2px 8px',
    borderRadius: 4,
    border: '1px solid #d9d9d9',
    background: '#ffffff',
    color: disabled ? '#a1a1a1' : '#093c52',
    cursor: disabled ? 'default' : 'pointer',
    fontSize: 11,
    whiteSpace: 'nowrap',
    lineHeight: '1.2',
  }
}

const inputStyle: CSSProperties = {
  width: 52,
  padding: '2px 6px',
  borderRadius: 4,
  border: '1px solid #d9d9d9',
  background: '#ffffff',
  color: '#191919',
  fontSize: 11,
  lineHeight: '1.2',
}

const errorInlineStyle: CSSProperties = {
  color: '#b42013',
  fontSize: 11,
}
