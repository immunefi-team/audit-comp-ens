import type { Meta, StoryObj } from '@storybook/tanstack-react'
import {
  JACQUARD_PATTERN3_DYE_BLEED_OPTIONS,
  JACQUARD_PATTERN6_DYE_BLEED_OPTIONS,
  JACQUARD_SHADERBOX_2_OPTIONS,
} from './presets'
// Stories exercise the full sandbox shader (ENS-mark / hover / stitch / all blend
// modes). The live app ships the trimmed WeaveCanvas + fragment.prod.glsl.
import { WeaveCanvasSandbox } from './WeaveCanvasSandbox'

const meta = {
  title: 'Components/WeaveLoader/WeaveCanvas',
  component: WeaveCanvasSandbox,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="h-[360px] w-[360px] overflow-hidden rounded-xl border border-border">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WeaveCanvasSandbox>

export default meta
type Story = StoryObj<typeof meta>

/** Default multi-colorway dye-bleed weave (the pink/blue fabric). */
export const Default: Story = {}

/** Single Lapis (blue) colorway, finer grid. */
export const Lapis: Story = {
  args: { options: { useAllColorways: false, palette: 2, gridSize: 24 } },
}

/** Houndstooth pattern with shimmer sweep enabled. */
export const HoundstoothShimmer: Story = {
  args: {
    options: {
      pattern: 13,
      useAllColorways: false,
      palette: 2,
      gridSize: 40,
      shimmer: true,
      shimmerWidth: 12,
      shimmerIntensity: 0.6,
    },
  },
}

/** Coarse grid, all colorways — shows the weave structure clearly. */
export const CoarseGrid: Story = {
  args: { options: { gridSize: 14 } },
}

/** Jacquard shaderbox 2 — dye-bleed all-colorways with bias play loop (44s). */
export const JacquardShaderbox2: Story = {
  render: () => <WeaveCanvasSandbox options={JACQUARD_SHADERBOX_2_OPTIONS} />,
}

export const JacquardPattern3DyeBleed: Story = {
  render: () => (
    <WeaveCanvasSandbox options={JACQUARD_PATTERN3_DYE_BLEED_OPTIONS} />
  ),
}

/** Jacquard pattern 6 — dye bleed with bias + noise X play loops. */
export const JacquardPattern6DyeBleed: Story = {
  render: () => (
    <WeaveCanvasSandbox options={JACQUARD_PATTERN6_DYE_BLEED_OPTIONS} />
  ),
}
