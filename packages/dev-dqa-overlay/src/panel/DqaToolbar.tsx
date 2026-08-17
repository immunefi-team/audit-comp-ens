import type { CSSProperties } from 'react'
import type { DqaState } from '../types'
import { DqaAvatar } from './DqaAvatar'
import { linearIssueUrl } from './linearUrl'
import { PANEL } from './panelTheme'

const MAX_VISIBLE_AVATARS = 5

type DqaToolbarProps = {
  readonly state: DqaState
  readonly onToggleCommentMode: () => void
  readonly onToggleHighlightAll?: () => void
  readonly onTogglePins?: () => void
  readonly showCommentMode?: boolean
}

function EyeIcon({ off }: { readonly off?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      style={{ width: 13, height: 13, flexShrink: 0 }}
      viewBox="0 0 24 24"
    >
      {off ? (
        <>
          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 11 8 11 8a13.16 13.16 0 0 1-1.67 2.68" />
          <path d="M6.61 6.61A13.526 13.526 0 0 0 1 12s4 8 11 8a9.74 9.74 0 0 0 5.39-1.61" />
          <line x1="2" x2="22" y1="2" y2="22" />
        </>
      ) : (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  )
}

function PresenceStrip({
  presence,
}: {
  readonly presence: DqaState['presence']
}) {
  const visible = presence.slice(0, MAX_VISIBLE_AVATARS)
  const overflow = presence.length - visible.length
  return (
    <div style={presenceGroupStyle}>
      <div style={presenceStyle} title={presence.map((p) => p.name).join(', ')}>
        {visible.map((peer, index) => (
          <DqaAvatar
            avatarUrl={peer.avatarUrl}
            color={peer.color}
            key={peer.id}
            name={peer.name}
            size={22}
            style={{ marginLeft: index === 0 ? 0 : -5 }}
            title={peer.name}
          />
        ))}
        {overflow > 0 && <span style={overflowStyle}>+{overflow}</span>}
      </div>
      <span style={viewingStyle}>{presence.length} viewing</span>
    </div>
  )
}

export function DqaToolbar({
  state,
  onToggleCommentMode,
  onToggleHighlightAll,
  onTogglePins,
  showCommentMode = true,
}: DqaToolbarProps) {
  const { commentMode, presence, pageIssueRef, outlineAll } = state
  const pinsVisible = state.showPins !== false
  const pageLinearUrl = pageIssueRef ? linearIssueUrl(pageIssueRef) : null

  return (
    <div style={toolbarStyle}>
      <div style={leftStyle}>
        {showCommentMode && (
          <button
            onClick={onToggleCommentMode}
            style={commentMode ? activeBtnStyle : primaryBtnStyle}
            title="Toggle inspect mode — or press C on the page"
            type="button"
          >
            <span style={btnInnerStyle}>
              <CursorIcon />
              {commentMode ? 'Pick an element' : 'Inspect'}
            </span>
          </button>
        )}

        {showCommentMode && onToggleHighlightAll && (
          <button
            onClick={onToggleHighlightAll}
            style={outlineAll ? activeBtnStyle : secondaryBtnStyle}
            title="Outline every commentable element on the page — click one to comment (helps find hard-to-hover elements)"
            type="button"
          >
            {outlineAll ? 'Hide outlines' : 'Highlight all'}
          </button>
        )}

        {onTogglePins && (
          <button
            aria-pressed={!pinsVisible}
            onClick={onTogglePins}
            style={pinsVisible ? secondaryBtnStyle : activeBtnStyle}
            title={
              pinsVisible
                ? 'Hide comment bubbles on the page'
                : 'Show comment bubbles on the page'
            }
            type="button"
          >
            <span style={eyeBtnInnerStyle}>
              <EyeIcon off={pinsVisible} />
              {pinsVisible ? 'Hide pins' : 'Show pins'}
            </span>
          </button>
        )}
      </div>

      <div style={rightStyle}>
        {pageIssueRef && pageLinearUrl && (
          <a
            href={pageLinearUrl}
            rel="noopener noreferrer"
            style={pageIssueStyle}
            target="_blank"
            title={`Open ${pageIssueRef} in Linear`}
          >
            {pageIssueRef} ↗
          </a>
        )}
        {presence.length > 0 && <PresenceStrip presence={presence} />}
      </div>
    </div>
  )
}

function CursorIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      style={{ width: 13, height: 13, flexShrink: 0 }}
      viewBox="0 0 24 24"
    >
      <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
    </svg>
  )
}

const toolbarStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  marginBottom: 12,
  paddingBottom: 10,
  borderBottom: `1px solid ${PANEL.border}`,
}

const leftStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 10,
}

const rightStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 8,
}

const baseBtnStyle: CSSProperties = {
  borderRadius: 8,
  padding: '6px 12px',
  font: PANEL.font,
  fontSize: 12.5,
  fontWeight: 550,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  userSelect: 'none',
}

const primaryBtnStyle: CSSProperties = {
  ...baseBtnStyle,
  border: `1px solid ${PANEL.primary}`,
  background: PANEL.primary,
  color: PANEL.onPrimary,
}

const activeBtnStyle: CSSProperties = {
  ...baseBtnStyle,
  border: `1px solid ${PANEL.accentBorder}`,
  background: PANEL.accentBg,
  color: PANEL.accent,
}

const secondaryBtnStyle: CSSProperties = {
  ...baseBtnStyle,
  border: `1px solid ${PANEL.border}`,
  background: 'transparent',
  color: PANEL.muted,
  fontWeight: 500,
}

const btnInnerStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
}

const eyeBtnInnerStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
}

const presenceGroupStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

const presenceStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
}

const overflowStyle: CSSProperties = {
  marginLeft: 4,
  font: PANEL.font,
  fontSize: 11,
  color: PANEL.muted,
}

const viewingStyle: CSSProperties = {
  font: PANEL.font,
  fontSize: 11,
  color: PANEL.faint,
}

const pageIssueStyle: CSSProperties = {
  font: PANEL.font,
  fontSize: 11,
  fontWeight: 600,
  color: PANEL.accent,
  textDecoration: 'none',
  padding: '4px 8px',
  borderRadius: 999,
  border: `1px solid ${PANEL.accentBorder}`,
  background: PANEL.accentBg,
}
