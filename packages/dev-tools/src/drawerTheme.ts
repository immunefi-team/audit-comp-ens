import type { CSSProperties } from 'react'

/**
 * DevDrawer tokens as CSS variables so the whole drawer themes at runtime.
 * The variable values are set on the drawer root (and trigger) from
 * `DRAWER_THEME_VARS[theme]` — dark is the default theme.
 *
 * Palette follows the DQA comment-card style guide: zinc neutrals, ink
 * primary buttons, blue for active/selected states, green for success.
 */
export const DRAWER = {
  bg: 'var(--dt-bg)',
  surface: 'var(--dt-surface)',
  fg: 'var(--dt-fg)',
  muted: 'var(--dt-muted)',
  faint: 'var(--dt-faint)',
  border: 'var(--dt-border)',
  borderSoft: 'var(--dt-border-soft)',
  borderStrong: 'var(--dt-border-strong)',
  chipBg: 'var(--dt-chip-bg)',
  accent: 'var(--dt-accent)',
  accentHover: 'var(--dt-accent-hover)',
  accentBg: 'var(--dt-accent-bg)',
  accentBorder: 'var(--dt-accent-border)',
  accentDense: 'var(--dt-accent-dense)',
  onAccent: 'var(--dt-on-accent)',
  primary: 'var(--dt-primary)',
  primaryHover: 'var(--dt-primary-hover)',
  onPrimary: 'var(--dt-on-primary)',
  success: 'var(--dt-success)',
  successBg: 'var(--dt-success-bg)',
  handleBg: 'var(--dt-handle-bg)',
  handleFg: 'var(--dt-handle-fg)',
  error: 'var(--dt-error)',
  errorBg: 'var(--dt-error-bg)',
  font: '12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontSans:
    '12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontMono: '11px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace',
} as const

/**
 * ENS brand system mapping:
 * - quartz  → neutrals (bg/surface/fg/muted/borders/chips)
 * - lapis   → accent (active/selected/links)
 * - peridot → success
 * - signal-danger → error
 * Garnet (magenta) marks the Design QA tool accent; citrine marks Migration.
 */
export const DRAWER_THEME_VARS: Record<'light' | 'dark', CSSProperties> = {
  light: {
    '--dt-bg': '#ffffff', // quartz-0
    '--dt-surface': '#faf9f7', // quartz-50
    '--dt-fg': '#191919', // quartz-900
    '--dt-muted': '#595755', // quartz-500
    '--dt-faint': '#a1a1a1', // quartz-350
    '--dt-border': '#e1e1e0', // quartz-200
    '--dt-border-soft': '#eeeded', // quartz-100
    '--dt-border-strong': '#d9d9d9', // quartz-250
    '--dt-chip-bg': '#f4f4f4', // quartz-75
    '--dt-accent': '#0080bc', // lapis-core
    '--dt-accent-hover': '#0070a4',
    '--dt-accent-bg': '#e5f7ff', // lapis-bg
    '--dt-accent-border': '#cee1e8', // lapis-dust
    '--dt-accent-dense': '#093c52', // lapis-dense
    '--dt-on-accent': '#ffffff',
    '--dt-primary': '#191919', // quartz-900
    '--dt-primary-hover': '#333333', // quartz-700
    '--dt-on-primary': '#ffffff',
    '--dt-success': '#007c23', // peridot-core
    '--dt-success-bg': '#d1eedf', // peridot-100
    '--dt-handle-bg': '#093c52', // lapis-dense
    '--dt-handle-fg': '#ffffff',
    '--dt-error': '#b42013', // signal-danger-600
    '--dt-error-bg': '#ffedeb', // signal-danger-100
  } as CSSProperties,
  dark: {
    '--dt-bg': '#191919', // quartz-900
    '--dt-surface': '#1f1f1e',
    '--dt-fg': '#f4f4f4', // quartz-75
    '--dt-muted': '#a1a1a1', // quartz-350
    '--dt-faint': '#7d7d7d', // quartz-380
    '--dt-border': '#333333', // quartz-700
    '--dt-border-soft': '#2a2a29',
    '--dt-border-strong': '#333333',
    '--dt-chip-bg': '#262625',
    '--dt-accent': '#39b4ea', // lapis-400
    '--dt-accent-hover': '#80c4e0', // lapis-300
    '--dt-accent-bg': '#02293b', // lapis-900
    '--dt-accent-border': '#0d4258',
    '--dt-accent-dense': '#dbf0f8', // lapis-100
    '--dt-on-accent': '#02293b',
    '--dt-primary': '#f4f4f4', // quartz-75
    '--dt-primary-hover': '#d9d9d9', // quartz-250
    '--dt-on-primary': '#191919',
    '--dt-success': '#1cbf46', // peridot-400
    '--dt-success-bg': '#033010', // peridot-900
    '--dt-handle-bg': '#02293b', // lapis-900
    '--dt-handle-fg': '#f4f4f4',
    '--dt-error': '#ffb3ac', // signal-danger-400
    '--dt-error-bg': '#440e09', // signal-danger-900
  } as CSSProperties,
}
