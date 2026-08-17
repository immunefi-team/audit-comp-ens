import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { ChevronRight, Loader2, Plus, Trash2 } from 'lucide-react'

import { MSymbol } from '@/components/ui/material-symbol'

import { Button, buttonVariants } from './Button'

const colors = Object.keys(
  buttonVariants.$variants.color,
) as (keyof typeof buttonVariants.$variants.color)[]
const sizes = Object.keys(
  buttonVariants.$variants.size,
) as (keyof typeof buttonVariants.$variants.size)[]

if (colors.length === 0 || sizes.length === 0) {
  throw new Error(
    'button.stories: buttonVariants must define at least one color and size',
  )
}

function labelFromId(id: string): string {
  return id
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase())
}

const catalogStates = [
  {
    key: 'default',
    label: 'Default',
    extra: {} as const,
  },
  {
    key: 'disabled',
    label: 'Disabled',
    extra: { disabled: true as const },
  },
  {
    key: 'loading',
    label: 'Loading',
    extra: { 'data-loading': true as const },
  },
] as const

const meta = {
  title: 'ENS Consumer/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    color: {
      control: 'select',
      options: colors,
    },
    size: {
      control: 'select',
      options: sizes,
    },
    disabled: {
      control: 'boolean',
    },
    focusableWhenDisabled: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

/** Use Controls for day‑to‑day inspection of props and children. */
export const Default: Story = {
  args: {
    children: 'Continue',
  },
}

/**
 * Every color × size × state, driven from `buttonVariants.$variants`.
 * Disabled styling comes from CVA. `data-loading` applies loading background tokens.
 */
export const Catalog: Story = {
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story:
          'Single overview for visual QA. Adding a color or size in `button.tsx` updates this table automatically.',
      },
    },
  },
  render: () => (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-lg border-collapse text-left text-sm">
          <thead>
            <tr className="border-border border-b bg-muted/40">
              <th className="p-3 font-medium" scope="col" />
              {sizes.map((size) => (
                <th
                  className="p-3 font-medium capitalize"
                  key={String(size)}
                  scope="col"
                >
                  {labelFromId(String(size))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {colors.flatMap((color) =>
              catalogStates.map((state) => (
                <tr
                  className="border-border border-b last:border-b-0"
                  key={`${String(color)}-${state.key}`}
                >
                  <th className="whitespace-nowrap p-3 font-medium" scope="row">
                    {labelFromId(String(color))}
                    <span className="text-muted-foreground">
                      {' '}
                      · {state.label}
                    </span>
                  </th>
                  {sizes.map((size) => (
                    <td className="p-3 align-middle" key={String(size)}>
                      <Button color={color} size={size} {...state.extra}>
                        {state.label}
                      </Button>
                    </td>
                  ))}
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground text-xs">
        Loading rows set{' '}
        <code className="rounded bg-muted px-1">data-loading</code> so Tailwind{' '}
        <code className="rounded bg-muted px-1">data-loading:*</code> classes
        apply.
      </p>
    </div>
  ),
}

export const LoadingWithSpinner: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      {colors.map((color) => (
        <Button
          className="gap-2"
          color={color}
          data-loading
          key={String(color)}
        >
          <Loader2 aria-hidden className="size-4 animate-spin" />
          {String(color)} — saving…
        </Button>
      ))}
    </div>
  ),
}

export const LucideIcons: Story = {
  render: () => {
    const primary = colors[0]
    const secondary = colors[1] ?? primary
    return (
      <div className="flex max-w-lg flex-col gap-6">
        <section className="flex flex-col gap-2">
          <h3 className="font-medium text-sm">
            With explicit <code className="rounded bg-muted px-1">size-4</code>{' '}
            (recommended)
          </h3>
          <div className="flex flex-wrap gap-2">
            <Button className="gap-2" color={primary}>
              <Plus aria-hidden className="size-4 shrink-0" />
              Add
            </Button>
            <Button className="gap-2" color={primary}>
              Next
              <ChevronRight aria-hidden className="size-4 shrink-0" />
            </Button>
            <Button className="gap-2" color={secondary}>
              <Trash2 aria-hidden className="size-4 shrink-0" />
              Remove
            </Button>
          </div>
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="font-medium text-sm">Without icon size utilities</h3>
          <p className="text-muted-foreground text-xs">
            SVG sizing helpers are currently commented out on this button, so
            Lucide may render at its intrinsic size until those utilities
            return.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button className="gap-2" color={primary}>
              <Plus aria-hidden className="shrink-0" />
              Add
            </Button>
            <Button className="gap-2" color={primary}>
              Next
              <ChevronRight aria-hidden className="shrink-0" />
            </Button>
          </div>
        </section>
      </div>
    )
  },
}

export const MaterialSymbols: Story = {
  render: () => {
    const primary = colors[0]
    const secondary = colors[1] ?? primary
    return (
      <div className="flex max-w-lg flex-col gap-4">
        <p className="text-muted-foreground text-xs">
          <code className="rounded bg-muted px-1">MSymbol</code> renders text
          that the Material Symbols font ligates into icons. Pair with{' '}
          <code className="rounded bg-muted px-1">ms-opsz-*</code> so optical
          size matches the button caps.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button className="gap-2" color={primary}>
            <MSymbol className="ms-opsz-20 ms-wght-500" symbol="search" />
            Search
          </Button>
          <Button className="gap-2" color={primary}>
            Settings
            <MSymbol className="ms-opsz-20 ms-wght-500" symbol="settings" />
          </Button>
          <Button className="gap-2" color={secondary}>
            <MSymbol className="ms-opsz-18 ms-wght-600" symbol="favorite" />
            Watchlist
          </Button>
        </div>
      </div>
    )
  },
}

export const MixedLucideAndMaterialSymbol: Story = {
  render: () => {
    const primary = colors[0]
    return (
      <Button className="gap-2" color={primary}>
        <MSymbol className="ms-opsz-20 ms-wght-500" symbol="mail" />
        Invite
        <ChevronRight aria-hidden className="size-4 shrink-0" />
      </Button>
    )
  },
}

export const IconOnly: Story = {
  render: () => {
    const [a, b] = colors
    return (
      <div className="flex flex-wrap gap-3">
        <Button aria-label="Delete" color={a}>
          <Trash2 aria-hidden className="size-4" />
        </Button>
        {b ? (
          <Button aria-label="Notifications" color={b}>
            <MSymbol
              className="ms-opsz-22 ms-wght-500"
              symbol="notifications"
            />
          </Button>
        ) : null}
      </div>
    )
  },
}

export const LongLabel: Story = {
  render: () => {
    const primary = colors[0]
    return (
      <div className="w-64 space-y-3">
        <p className="text-muted-foreground text-xs">
          Label uses{' '}
          <code className="rounded bg-muted px-1">whitespace-nowrap</code>; in a
          narrow container the button grows horizontally instead of wrapping.
        </p>
        <Button className="min-w-0 max-w-full" color={primary}>
          This is an unusually long action label for layout stress-testing
        </Button>
      </div>
    )
  },
}

export const StatesWithIcons: Story = {
  render: () => {
    const primary = colors[0]
    const secondary = colors[1]
    if (!secondary) {
      return (
        <div className="grid max-w-xl gap-3 sm:grid-cols-2">
          <Button className="gap-2" color={primary} disabled>
            <Plus aria-hidden className="size-4 shrink-0" />
            Disabled + Lucide
          </Button>
          <Button className="gap-2" color={primary} data-loading>
            <Loader2 aria-hidden className="size-4 shrink-0 animate-spin" />
            Loading + Lucide
          </Button>
          <Button className="gap-2" color={primary} disabled>
            <MSymbol className="ms-opsz-20 ms-wght-500" symbol="edit" />
            Disabled + symbol
          </Button>
          <Button className="gap-2" color={primary} data-loading>
            <MSymbol className="ms-opsz-20 ms-wght-500" symbol="cached" />
            Loading + symbol
          </Button>
        </div>
      )
    }
    return (
      <div className="grid max-w-xl gap-3 sm:grid-cols-2">
        <Button className="gap-2" color={primary} disabled>
          <Plus aria-hidden className="size-4 shrink-0" />
          Disabled with icon
        </Button>
        <Button className="gap-2" color={primary} data-loading>
          <Loader2 aria-hidden className="size-4 shrink-0 animate-spin" />
          Loading with icon
        </Button>
        <Button className="gap-2" color={secondary} disabled>
          <MSymbol className="ms-opsz-20 ms-wght-500" symbol="edit" />
          Disabled + symbol
        </Button>
        <Button className="gap-2" color={secondary} data-loading>
          <MSymbol className="ms-opsz-20 ms-wght-500" symbol="cached" />
          Loading + symbol
        </Button>
      </div>
    )
  },
}

export const NativeTypes: Story = {
  render: () => {
    const primary = colors[0]
    const secondary = colors[1] ?? primary
    return (
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
        }}
      >
        <Button className="gap-2" color={primary} type="submit">
          <ChevronRight aria-hidden className="size-4 shrink-0" />
          Submit (native)
        </Button>
        <Button color={secondary} type="button">
          Button type=&quot;button&quot; (no implicit submit)
        </Button>
      </form>
    )
  },
}

export const FocusableWhenDisabled: Story = {
  render: () => {
    const primary = colors[0]
    return (
      <div className="max-w-md space-y-2">
        <p className="text-muted-foreground text-xs">
          Tab into the disabled control:{' '}
          <code className="rounded bg-muted px-1">focusableWhenDisabled</code>{' '}
          keeps it in the tab order (Base UI prop).
        </p>
        <Button color={primary} disabled focusableWhenDisabled>
          Still focusable when disabled
        </Button>
      </div>
    )
  },
}
