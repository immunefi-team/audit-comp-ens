import type { CSSProperties } from 'react'

export const iconActionClassName =
  'flex size-13.5 shrink-0 items-center justify-center rounded bg-white text-ens-quartz-700 shadow-[0_2px_6px_rgba(0,0,0,0.06)] transition hover:bg-ens-quartz-50 disabled:cursor-not-allowed disabled:opacity-50'

export const renewActionClassName =
  'inline-flex h-13.5 min-w-34 items-center justify-center gap-1 whitespace-nowrap rounded border-none bg-white px-3 py-0 font-semi-mono text-xs text-ens-quartz-900 uppercase tracking-[0.96px] shadow-[0_2px_6px_rgba(0,0,0,0.06)] hover:bg-ens-quartz-50 disabled:cursor-wait disabled:opacity-60 lg:landscape:w-33 lg:landscape:min-w-33'

export const editActionClassName =
  'h-15.25 w-full max-w-87 rounded border-none bg-(--theme-button-bg) px-6 py-0 font-semi-mono text-sm text-(--theme-button-text) uppercase tracking-[1.12px] shadow-none hover:bg-(--theme-button-hover-bg) lg:landscape:h-12.5 lg:landscape:w-42.75'

export const editBottomNavClassName =
  'fixed inset-x-0 bottom-0 z-40 bg-white shadow-[0_-3px_2px_rgba(220,220,220,0.25)] lg:landscape:shadow-[0_-3.24px_91px_rgba(7,28,47,0.12)]'

export const editBottomNavContentClassName =
  'mx-auto flex w-full max-w-97.5 justify-center px-5 pt-3 pb-[calc(44px+env(safe-area-inset-bottom,0))] lg:landscape:max-w-360 lg:landscape:justify-end lg:landscape:gap-3 lg:landscape:px-8 lg:landscape:py-4'

export const desktopActionContainerClassName =
  'absolute top-[422px] z-30 hidden w-33 flex-col gap-6 lg:landscape:flex'

export const desktopActionContainerStyle = {
  left: 'min(calc(50% + 452.5px), calc(100% - 164px))',
} satisfies CSSProperties
