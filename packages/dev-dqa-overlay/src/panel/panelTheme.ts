/**
 * DQA panel tokens — CSS variable references resolved by the DevDrawer root,
 * which sets the `--dt-*` values per theme (dark default). Mirrors
 * dev-tools/drawerTheme. Palette follows the DQA comment-card style guide.
 */
export const PANEL = {
  bg: 'var(--dt-bg)',
  surface: 'var(--dt-surface)',
  fg: 'var(--dt-fg)',
  muted: 'var(--dt-muted)',
  faint: 'var(--dt-faint, var(--dt-muted))',
  border: 'var(--dt-border)',
  borderSoft: 'var(--dt-border-soft, var(--dt-border))',
  borderStrong: 'var(--dt-border-strong)',
  chipBg: 'var(--dt-chip-bg, var(--dt-surface))',
  accent: 'var(--dt-accent)',
  accentHover: 'var(--dt-accent-hover)',
  accentBg: 'var(--dt-accent-bg)',
  accentBorder: 'var(--dt-accent-border, var(--dt-accent))',
  accentDense: 'var(--dt-accent-dense)',
  onAccent: 'var(--dt-on-accent)',
  primary: 'var(--dt-primary, var(--dt-accent))',
  primaryHover: 'var(--dt-primary-hover, var(--dt-accent-hover))',
  onPrimary: 'var(--dt-on-primary, var(--dt-on-accent))',
  error: 'var(--dt-error)',
  errorBg: 'var(--dt-error-bg, transparent)',
  success: 'var(--dt-success, var(--dt-accent-dense))',
  successBg: 'var(--dt-success-bg, transparent)',
  font: '12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontSans:
    '12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontMono: '11px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace',
} as const
