import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useCallback, useMemo, useState } from 'react'
import { formatPriceForInput } from '../../lib/formatPriceForInput'
import {
  type LeaderPlacement,
  PREMIUM_RES_PER_DAY,
  pointAtDate,
  pointAtPrice,
  posAtPoint,
  TemporaryPremiumChart,
  TemporaryPremiumChartDebugControls,
  type TemporaryPremiumChartDebugState,
  UNIT_CHART_GEO,
} from './TemporaryPremiumChart'

/** Match ens_premium_chart_final.html: ~6.5 days into the 21-day window. */
const mockStartDate = (() => {
  const nowMs = Date.now()
  const startMs = Math.round(nowMs - 6.5 * 86_400_000)
  return new Date(startMs)
})()

const mockNowPoint = pointAtDate(new Date(), mockStartDate)

// Initial black-dot selection: ~3 days past `now`.
const INITIAL_SELECTED_POINT =
  mockNowPoint + Math.floor(PREMIUM_RES_PER_DAY * 3)

type SimulationSettings = {
  enabled: boolean
  intervalMs: number
  /** Multiplier on one hour of decay per tick (reference uses 0.4). */
  decayPerTick: number
}

/** Defaults from ens_premium_chart_final.html */
const DEFAULT_SIMULATION: SimulationSettings = {
  enabled: true,
  intervalMs: 2_000,
  decayPerTick: 0.4,
}

function TemporaryPremiumDebugPlayground() {
  const [selectedPoint, setSelectedPoint] = useState(INITIAL_SELECTED_POINT)
  const [priceInput, setPriceInput] = useState('')
  // Toggle the mobile "labels below the chart" layout. Off = desktop on-chart
  // pills (the default / production desktop behaviour); on = mobile/compact
  // path with the dashed leader + label rendered below the chart.
  const [labelBelow, setLabelBelow] = useState(false)
  const [simulation, setSimulation] =
    useState<SimulationSettings>(DEFAULT_SIMULATION)
  const [simulationKey, setSimulationKey] = useState(0)
  const [debugState, setDebugState] = useState<TemporaryPremiumChartDebugState>(
    {
      steepThreshold: 1,
      showOverlay: false,
    },
  )
  const [placement, setPlacement] = useState<LeaderPlacement | null>(null)

  const handleSelect = useCallback((point: number) => {
    setSelectedPoint(point)
    setPriceInput(formatPriceForInput(posAtPoint(point, UNIT_CHART_GEO).price))
  }, [])

  const handlePriceChange = (raw: string) => {
    setPriceInput(raw)
    const parsed = Number.parseFloat(raw.replace(/,/g, ''))
    if (!Number.isFinite(parsed) || parsed < 0) return
    setSelectedPoint(pointAtPrice(parsed))
  }

  const restartSimulation = () => {
    setSimulationKey((value) => value + 1)
    setSelectedPoint(INITIAL_SELECTED_POINT)
    setPriceInput('')
  }

  const simulatePolling = useMemo(
    () =>
      simulation.enabled
        ? {
            intervalMs: simulation.intervalMs,
            decayPerTick: simulation.decayPerTick,
          }
        : undefined,
    [simulation.decayPerTick, simulation.enabled, simulation.intervalMs],
  )

  const chartDebug = useMemo(
    () => ({
      onPlacementChange: setPlacement,
      showOverlay: debugState.showOverlay,
      simulatePolling,
    }),
    [debugState.showOverlay, simulatePolling],
  )

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4">
      <header className="flex flex-col gap-2">
        <h1 className="font-semibold text-2xl text-ens-quartz-900">
          Temporary premium chart
        </h1>
        <p className="text-ens-quartz-400 text-sm leading-relaxed">
          Same as the HTML reference: polling advances the now target every 2s,
          and the blue dot glides down the curve while the price label tweens.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex flex-col gap-3 rounded-xl border border-ens-gray-two bg-white p-4">
          <h2 className="font-medium text-[#353535] text-sm">
            Target price (black dot)
          </h2>
          <div className="flex h-12 items-stretch overflow-hidden rounded-md border border-ens-gray-two">
            <span className="flex items-center border-ens-gray-two border-r bg-ens-white px-4 text-[#64748B]">
              $
            </span>
            <input
              className="min-w-0 flex-1 px-3 text-ens-quartz-900 text-sm outline-none"
              inputMode="decimal"
              onChange={(e) =>
                handlePriceChange(e.target.value.replace(/[^0-9.,]/g, ''))
              }
              placeholder="Enter a price"
              value={priceInput}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-ens-gray-two bg-[#fafafa] p-4">
          <h2 className="font-medium text-[#353535] text-sm">Simulation</h2>
          <label className="flex cursor-pointer items-center gap-2 text-[#353535] text-sm">
            <input
              checked={simulation.enabled}
              className="accent-[#0082BB]"
              onChange={(e) =>
                setSimulation((prev) => ({
                  ...prev,
                  enabled: e.target.checked,
                }))
              }
              type="checkbox"
            />
            Cooldown polling
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[#353535] text-sm">
            <input
              checked={labelBelow}
              className="accent-[#0082BB]"
              onChange={(e) => setLabelBelow(e.target.checked)}
              type="checkbox"
            />
            Labels below chart (mobile)
          </label>
          <label className="flex flex-col gap-1 text-[#353535] text-xs">
            Interval ({simulation.intervalMs}ms)
            <input
              className="accent-[#0082BB]"
              max={10_000}
              min={500}
              onChange={(e) =>
                setSimulation((prev) => ({
                  ...prev,
                  intervalMs: Number.parseInt(e.target.value, 10),
                }))
              }
              step={250}
              type="range"
              value={simulation.intervalMs}
            />
          </label>
          <label className="flex flex-col gap-1 text-[#353535] text-xs">
            Decay ({simulation.decayPerTick.toFixed(1)}× 1h / tick)
            <input
              className="accent-[#0082BB]"
              max={4}
              min={0.1}
              onChange={(e) =>
                setSimulation((prev) => ({
                  ...prev,
                  decayPerTick: Number.parseFloat(e.target.value),
                }))
              }
              step={0.1}
              type="range"
              value={simulation.decayPerTick}
            />
          </label>
          <button
            className="rounded-md border border-[#0082BB] bg-white px-3 py-2 font-medium text-[#0082BB] text-sm hover:bg-[#effafe]"
            onClick={restartSimulation}
            type="button"
          >
            Restart
          </button>
        </div>
      </section>

      <TemporaryPremiumChartDebugControls
        onChange={setDebugState}
        placement={placement}
        state={debugState}
      />

      <TemporaryPremiumChart
        allowPastSelection
        debug={chartDebug}
        height={260}
        key={`live-${simulationKey}`}
        leaderConfig={{ steepThreshold: debugState.steepThreshold }}
        nowPoint={mockNowPoint}
        onSelect={handleSelect}
        selectedLabelBelow={labelBelow}
        selectedPoint={selectedPoint}
        startDate={mockStartDate}
        tweenDurationMs={1_500}
        tweenNowPrice={simulation.enabled}
      />
    </div>
  )
}

const meta = {
  title: 'Register v2/Pricing/Price cooldown/Temporary premium chart',
  component: TemporaryPremiumDebugPlayground,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof TemporaryPremiumDebugPlayground>

export default meta

type Story = StoryObj<typeof meta>

/** Interactive demo matching ens_premium_chart_final.html */
export const DebugPlayground: Story = {}

// ~$90M "now" near the top of the $100M curve; selected/user value at ~$20M —
// a wide "millions" label, good for testing the edge clamping below the chart.
const HIGH_NOW_POINT = pointAtPrice(90_000_000)
const HIGH_NOW_SELECTED_POINT = pointAtPrice(20_000_000)
const HIGH_NOW_START_DATE = new Date()

/**
 * High premium range in the labels-below layout: ~$90M "now" near the top of
 * the $100M curve, with the user-selected value at ~$20M. Use this to verify
 * the downward dashed leaders and that the wide "millions" under-chart labels
 * stay clamped within the chart edges (don't spill off left/right).
 */
function HighNowLabelsBelowDemo() {
  const [selectedPoint, setSelectedPoint] = useState(HIGH_NOW_SELECTED_POINT)

  return (
    <div className="mx-auto w-full max-w-md p-6">
      <TemporaryPremiumChart
        height={240}
        nowPoint={HIGH_NOW_POINT}
        onSelect={setSelectedPoint}
        selectedLabelBelow
        selectedPoint={selectedPoint}
        startDate={HIGH_NOW_START_DATE}
        tweenNowPrice={false}
      />
    </div>
  )
}

export const HighNowLabelsBelow: Story = {
  render: () => <HighNowLabelsBelowDemo />,
}
