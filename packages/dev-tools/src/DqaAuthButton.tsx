/**
 * Topbar Sign in / profile control for DQA. Signed-out: Sign in opens the
 * Linear OAuth popup directly. Signed-in: avatar opens a small menu (sign out /
 * switch account). Dev-mode login is only used when OAuth is not configured.
 */

import { type DqaApi, DqaAvatar, type DqaUser } from '@ens-apps/dev-dqa-overlay'
import { type CSSProperties, useEffect, useId, useRef, useState } from 'react'
import { DRAWER } from './drawerTheme'

type DqaAuthButtonProps = {
  readonly api: DqaApi | null
  readonly user: DqaUser | null
  readonly authenticated: boolean
  readonly oauthConfigured: boolean
  readonly devAllowed: boolean
  readonly signInError: string | null
  readonly ready: boolean
}

export function DqaAuthButton({
  api,
  user,
  authenticated,
  oauthConfigured,
  devAllowed,
  signInError,
  ready,
}: DqaAuthButtonProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!ready) return null
  if (!oauthConfigured && !devAllowed && !authenticated) return null

  const close = () => setOpen(false)

  if (authenticated && user) {
    return (
      <div ref={rootRef} style={rootStyle}>
        <button
          aria-controls={menuId}
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((value) => !value)}
          style={profileBtnStyle}
          title={user.name}
          type="button"
        >
          <DqaAvatar
            avatarUrl={user.avatarUrl}
            color={user.color}
            name={user.name}
            size={22}
          />
          <span style={nameStyle}>{user.name}</span>
        </button>
        {open && (
          <div id={menuId} role="menu" style={menuStyle}>
            <div style={menuHeaderStyle}>{user.name}</div>
            {oauthConfigured && (
              <button
                onClick={() => {
                  api?.switchLinearAccount()
                  close()
                }}
                role="menuitem"
                style={menuItemStyle}
                type="button"
              >
                Use different account
              </button>
            )}
            <button
              onClick={() => {
                void api?.signOut()
                close()
              }}
              role="menuitem"
              style={menuItemStyle}
              type="button"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    )
  }

  // Prefer Linear OAuth popup — same as the old panel "Sign in with Linear".
  if (oauthConfigured) {
    return (
      <div style={rootStyle}>
        <button
          onClick={() => api?.startLinearLogin()}
          style={signInBtnStyle}
          title="Sign in with Linear"
          type="button"
        >
          Sign in
        </button>
        {signInError && <p style={inlineErrorStyle}>{signInError}</p>}
      </div>
    )
  }

  // OAuth not configured: single-click Dev mode (no name prompt).
  return (
    <div style={rootStyle}>
      <button
        // Empty name → server assigns a unique "Dev N" per session, so each
        // browser appears as a separate live user.
        onClick={() => void api?.devLogin('')}
        style={signInBtnStyle}
        title="Dev mode sign in"
        type="button"
      >
        Sign in
      </button>
      {signInError && <p style={inlineErrorStyle}>{signInError}</p>}
    </div>
  )
}

const rootStyle: CSSProperties = {
  position: 'relative',
  flexShrink: 0,
}

const signInBtnStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: `1px solid ${DRAWER.accent}`,
  background: DRAWER.accent,
  color: DRAWER.onAccent,
  borderRadius: 6,
  padding: '5px 10px',
  font: DRAWER.font,
  fontWeight: 600,
  fontSize: 12,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const profileBtnStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  maxWidth: 148,
  border: `1px solid ${DRAWER.border}`,
  background: DRAWER.surface,
  color: DRAWER.fg,
  borderRadius: 6,
  padding: '3px 8px 3px 3px',
  font: DRAWER.font,
  fontWeight: 500,
  fontSize: 12,
  cursor: 'pointer',
}

const nameStyle: CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 12,
  fontWeight: 500,
  color: DRAWER.fg,
}

const menuStyle: CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 6px)',
  right: 0,
  zIndex: 20,
  minWidth: 200,
  padding: 6,
  borderRadius: 8,
  border: `1px solid ${DRAWER.borderStrong}`,
  background: DRAWER.bg,
  boxShadow: '0 8px 24px rgba(9, 60, 82, 0.18)',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
}

const menuHeaderStyle: CSSProperties = {
  padding: '6px 8px 8px',
  fontSize: 11,
  fontWeight: 600,
  color: DRAWER.muted,
  borderBottom: `1px solid ${DRAWER.border}`,
  marginBottom: 4,
}

const menuItemStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  border: 'none',
  background: 'transparent',
  color: DRAWER.fg,
  borderRadius: 6,
  padding: '8px 10px',
  font: DRAWER.font,
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
}

const inlineErrorStyle: CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 4px)',
  right: 0,
  margin: 0,
  maxWidth: 220,
  color: DRAWER.error,
  font: DRAWER.font,
  fontSize: 11,
  lineHeight: 1.35,
  whiteSpace: 'normal',
}
