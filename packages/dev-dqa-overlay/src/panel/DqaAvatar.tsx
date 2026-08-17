import { type CSSProperties, useState } from 'react'
import { PANEL } from './panelTheme'

// ENS brand gem colors — must stay in the same order as overlay.js
// AVATAR_COLORS so a user gets the same color in the panel and on pins.
const AVATAR_COLORS = [
  '#0080bc', // ens-lapis-core
  '#007c23', // ens-peridot-core
  '#8a0a49', // ens-garnet-dense
  '#b35600', // ens-citrine-600
  '#674d49', // ens-bronzite-core
  '#093c52', // ens-lapis-dense
  '#f53293', // ens-garnet-core
  '#c82e1f', // ens-signal-danger-500
] as const

function avatarColor(name: string): string {
  let h = 0
  for (const ch of name || '?') h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]
}

function initial(name: string): string {
  return (name.trim()[0] || '?').toUpperCase()
}

type DqaAvatarProps = {
  readonly name: string
  readonly avatarUrl?: string | null
  readonly color?: string
  readonly size?: number
  readonly title?: string
  readonly style?: CSSProperties
}

/** Linear photo when available; otherwise a colored letter (Figma-style). */
export function DqaAvatar({
  name,
  avatarUrl,
  color,
  size = 22,
  title,
  style,
}: DqaAvatarProps) {
  const [failed, setFailed] = useState(false)
  const bg = color || avatarColor(name)
  const showImg = !!avatarUrl && !failed

  return (
    <span
      aria-hidden
      style={{
        ...baseStyle,
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.45)),
        background: bg,
        ...style,
      }}
      title={title ?? name}
    >
      {showImg ? (
        <img
          alt=""
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
          src={avatarUrl}
          style={imgStyle}
        />
      ) : (
        initial(name)
      )}
    </span>
  )
}

const baseStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '50%',
  color: '#fff',
  fontWeight: 700,
  flexShrink: 0,
  overflow: 'hidden',
  fontFamily: PANEL.fontSans,
  // line-height 1 keeps the initial optically centered in the circle
  // (default `normal` sits the glyph above center).
  lineHeight: 1,
  userSelect: 'none',
}

const imgStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
}
