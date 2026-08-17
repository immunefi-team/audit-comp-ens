import type { CSSProperties } from 'react'
import { PANEL } from './panelTheme'

type DqaPreviewBannerProps = {
  readonly message?: string
}

export function DqaPreviewBanner({
  message = 'Preview — sample data',
}: DqaPreviewBannerProps) {
  return (
    <div style={bannerStyle} role="status">
      {message}
    </div>
  )
}

const bannerStyle: CSSProperties = {
  margin: '0 0 10px',
  padding: '6px 10px',
  borderRadius: 6,
  background: PANEL.accentBg,
  border: `1px solid ${PANEL.borderStrong}`,
  color: PANEL.accentDense,
  font: PANEL.font,
  fontSize: 10,
}
