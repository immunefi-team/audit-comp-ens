import { type CSSProperties, useState } from 'react'
import type { DqaCommentSummary } from '../types'
import { DqaAvatar } from './DqaAvatar'
import { formatRelativeTime } from './formatRelativeTime'
import { linearIssueUrl } from './linearUrl'
import { PANEL } from './panelTheme'

type DqaCommentCardProps = {
  readonly comment: DqaCommentSummary
  readonly active: boolean
  readonly onFocus: () => void
  readonly onResolve?: () => void
  readonly onDelete?: () => void
  /** Returns true when the comment's Markdown was copied to the clipboard. */
  readonly onCopyMarkdown?: () => Promise<boolean>
  readonly showFocusAction?: boolean
}

export function DqaCommentCard({
  comment,
  active,
  onFocus,
  onResolve,
  onDelete,
  onCopyMarkdown,
  showFocusAction = true,
}: DqaCommentCardProps) {
  const [copied, setCopied] = useState<null | boolean>(null)
  const [hovered, setHovered] = useState(false)
  const linearUrl =
    comment.linear?.url ??
    (comment.issueRef ? linearIssueUrl(comment.issueRef) : null)
  const linearLabel = comment.linear?.identifier ?? comment.issueRef
  const clickable = showFocusAction
  const resolved = comment.status === 'resolved'
  const hasActions =
    showFocusAction && (onResolve || onDelete || onCopyMarkdown)

  return (
    // biome-ignore lint/a11y/useSemanticElements: clickable card with inner controls
    <article
      aria-label={clickable ? 'Focus comment on page' : undefined}
      onClick={clickable ? onFocus : undefined}
      onKeyDown={
        clickable
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onFocus()
              }
            }
          : undefined
      }
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      style={{
        ...cardStyle,
        ...(clickable ? cardClickableStyle : undefined),
        ...(hovered ? cardHoverStyle : undefined),
        ...(active ? cardActiveStyle : undefined),
      }}
    >
      <div style={headerStyle}>
        <DqaAvatar
          avatarUrl={comment.authorAvatar}
          name={comment.author}
          size={22}
        />
        <span style={pinNumStyle}>
          {resolved ? '✓' : `#${comment.pinIndex}`}
        </span>
        {comment.anchorLabel && (
          <span style={tagElStyle} title={comment.anchorLabel}>
            {comment.anchorLabel}
          </span>
        )}
        <span
          style={{
            ...statusStyle,
            ...(resolved ? statusResolvedStyle : statusOpenStyle),
          }}
        >
          {resolved ? 'RESOLVED' : 'OPEN'}
        </span>
      </div>

      <p style={bodyStyle}>"{comment.body}"</p>

      <div style={metaStyle}>
        <span>{comment.author}</span>
        {comment.replyCount > 0 && (
          <span>
            · {comment.replyCount}{' '}
            {comment.replyCount === 1 ? 'reply' : 'replies'}
          </span>
        )}
        <span>· {formatRelativeTime(comment.createdAt)}</span>
        {comment.linearDeleted ? (
          <span
            style={linearDeletedStyle}
            title="The pushed comment/issue was deleted in Linear"
          >
            · {linearLabel ?? 'Linear'} deleted in Linear
          </span>
        ) : linearLabel && linearUrl ? (
          <a
            href={linearUrl}
            onClick={(event) => event.stopPropagation()}
            rel="noopener noreferrer"
            style={linearLinkStyle}
            target="_blank"
          >
            {linearLabel} ↗
          </a>
        ) : (
          <span style={notLinkedStyle}>· Not in Linear yet</span>
        )}
      </div>

      {hasActions && (
        <div
          style={{
            ...actionsStyle,
            ...(hovered || active ? actionsVisibleStyle : undefined),
          }}
        >
          {onCopyMarkdown && (
            <button
              onClick={(event) => {
                event.stopPropagation()
                void onCopyMarkdown().then((ok) => {
                  setCopied(ok)
                  setTimeout(() => setCopied(null), 1500)
                })
              }}
              style={miniActionStyle}
              title="Copy this comment as Markdown (for AI tooling)"
              type="button"
            >
              <MiniIcon kind="copy" />
              {copied === null ? 'Copy' : copied ? 'Copied ✓' : 'Copy failed'}
            </button>
          )}
          {onDelete && (
            <button
              onClick={(event) => {
                event.stopPropagation()
                onDelete()
              }}
              style={{ ...miniActionStyle, color: PANEL.error }}
              title="Delete this DQA comment (does not touch Linear)"
              type="button"
            >
              <MiniIcon kind="trash" />
              Delete
            </button>
          )}
          {!resolved && onResolve && (
            <button
              onClick={(event) => {
                event.stopPropagation()
                onResolve()
              }}
              style={{ ...miniActionStyle, color: PANEL.success }}
              title="Mark as resolved (moves out of the Open filter)"
              type="button"
            >
              <MiniIcon kind="check" />
              Resolve
            </button>
          )}
        </div>
      )}
    </article>
  )
}

function MiniIcon({ kind }: { readonly kind: 'copy' | 'trash' | 'check' }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      style={{ width: 12, height: 12, flexShrink: 0 }}
      viewBox="0 0 24 24"
    >
      {kind === 'copy' ? (
        <>
          <rect height="13" rx="2" width="13" x="9" y="9" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </>
      ) : kind === 'trash' ? (
        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      ) : (
        <>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <path d="M22 4L12 14.01l-3-3" />
        </>
      )}
    </svg>
  )
}

const cardStyle: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: `1px solid ${PANEL.border}`,
  background: PANEL.bg,
  transition: 'border-color .15s, box-shadow .15s',
}

const cardClickableStyle: CSSProperties = {
  cursor: 'pointer',
}

const cardHoverStyle: CSSProperties = {
  borderColor: PANEL.faint,
  boxShadow: '0 2px 8px rgba(0,0,0,.06)',
}

const cardActiveStyle: CSSProperties = {
  borderColor: PANEL.accent,
  background: PANEL.accentBg,
  boxShadow: `0 0 0 1px ${PANEL.accent}`,
}

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  marginBottom: 6,
  minWidth: 0,
}

const pinNumStyle: CSSProperties = {
  flexShrink: 0,
  font: PANEL.font,
  fontSize: 10.5,
  fontWeight: 700,
  color: PANEL.onPrimary,
  background: PANEL.primary,
  borderRadius: 999,
  padding: '1px 7px',
  lineHeight: 1.6,
}

const tagElStyle: CSSProperties = {
  font: PANEL.fontMono,
  fontSize: 11,
  padding: '2px 7px',
  borderRadius: 999,
  background: PANEL.accentBg,
  color: PANEL.accent,
  border: `1px solid ${PANEL.accentBorder}`,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
}

const statusStyle: CSSProperties = {
  marginLeft: 'auto',
  flexShrink: 0,
  font: PANEL.font,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.05em',
  padding: '2px 8px',
  borderRadius: 999,
}

const statusOpenStyle: CSSProperties = {
  color: PANEL.accent,
  background: PANEL.accentBg,
  border: `1px solid ${PANEL.accentBorder}`,
}

const statusResolvedStyle: CSSProperties = {
  color: PANEL.success,
  background: PANEL.successBg,
  border: `1px solid ${PANEL.successBg}`,
}

const bodyStyle: CSSProperties = {
  margin: '0 0 5px',
  font: PANEL.fontSans,
  fontSize: 13,
  lineHeight: 1.5,
  color: PANEL.fg,
}

const metaStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 4,
  font: PANEL.font,
  fontSize: 11,
  color: PANEL.faint,
}

const linearLinkStyle: CSSProperties = {
  color: PANEL.accent,
  fontWeight: 600,
  textDecoration: 'none',
}

const notLinkedStyle: CSSProperties = {
  fontStyle: 'italic',
}

const linearDeletedStyle: CSSProperties = {
  color: PANEL.error,
  fontWeight: 600,
  textDecoration: 'line-through',
}

const actionsStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 4,
  marginTop: 8,
  paddingTop: 8,
  borderTop: `1px solid ${PANEL.borderSoft}`,
  opacity: 0,
  transition: 'opacity .15s',
}

const actionsVisibleStyle: CSSProperties = {
  opacity: 1,
}

const miniActionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  font: PANEL.font,
  fontSize: 11.5,
  fontWeight: 500,
  color: PANEL.muted,
  padding: '4px 8px',
  borderRadius: 6,
}
