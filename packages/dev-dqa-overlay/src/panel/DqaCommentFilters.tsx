import { type CSSProperties, useState } from 'react'
import type { DqaCommentSummary } from '../types'
import { PANEL } from './panelTheme'

export type CommentFilter = 'open' | 'resolved' | 'all'
export type CommentOwnership = 'all' | 'mine'

type DqaCommentFiltersProps = {
  readonly comments: readonly DqaCommentSummary[]
  readonly filter: CommentFilter
  readonly onFilterChange: (filter: CommentFilter) => void
  readonly ownership?: CommentOwnership
  readonly onOwnershipChange?: (ownership: CommentOwnership) => void
  readonly showResolvedPins?: boolean
  readonly onToggleResolvedPins?: () => void
  /** Copies every page comment as Markdown; resolves true on success. */
  readonly onCopyAllMarkdown?: () => Promise<boolean>
}

export function DqaCommentFilters({
  comments,
  filter,
  onFilterChange,
  ownership = 'all',
  onOwnershipChange,
  showResolvedPins = false,
  onToggleResolvedPins,
  onCopyAllMarkdown,
}: DqaCommentFiltersProps) {
  const [copiedAll, setCopiedAll] = useState<null | boolean>(null)
  const openCount = comments.filter((c) => c.status === 'open').length
  const resolvedCount = comments.filter((c) => c.status === 'resolved').length

  const tabs: { key: CommentFilter; label: string; count: number }[] = [
    { key: 'open', label: 'Open', count: openCount },
    { key: 'resolved', label: 'Resolved', count: resolvedCount },
    { key: 'all', label: 'All', count: comments.length },
  ]

  return (
    <div style={wrapStyle}>
      <div style={rowStyle} role="tablist" aria-label="Comment filters">
        {tabs.map((tab) => {
          const active = filter === tab.key
          return (
            <button
              aria-selected={active}
              key={tab.key}
              onClick={() => onFilterChange(tab.key)}
              role="tab"
              style={{
                ...chipStyle,
                ...(active ? chipActiveStyle : undefined),
              }}
              type="button"
            >
              {tab.label}
              <span
                style={{
                  ...chipCountStyle,
                  ...(active ? chipCountActiveStyle : undefined),
                }}
              >
                {tab.count}
              </span>
            </button>
          )
        })}

        {onCopyAllMarkdown && comments.length > 0 && (
          <button
            onClick={() => {
              void onCopyAllMarkdown().then((ok) => {
                setCopiedAll(ok)
                setTimeout(() => setCopiedAll(null), 1500)
              })
            }}
            style={actionChipStyle}
            title="Copy all page comments as Markdown (for AI tooling)"
            type="button"
          >
            <CopyIcon />
            {copiedAll === null
              ? 'Copy all'
              : copiedAll
                ? 'Copied ✓'
                : 'Copy failed'}
          </button>
        )}
      </div>

      {(onToggleResolvedPins || onOwnershipChange) && (
        <div style={rowStyle}>
          {onToggleResolvedPins && (
            <button
              aria-pressed={showResolvedPins}
              onClick={onToggleResolvedPins}
              style={{
                ...chipStyle,
                ...(showResolvedPins ? chipActiveStyle : undefined),
              }}
              title="Show or hide resolved comments' pins on the page"
              type="button"
            >
              {showResolvedPins ? '✓ Resolved pins' : 'Resolved pins'}
            </button>
          )}

          {onOwnershipChange && (
            <fieldset aria-label="Comment ownership" style={segmentStyle}>
              {(['all', 'mine'] as const).map((key) => {
                const active = ownership === key
                return (
                  <button
                    aria-pressed={active}
                    key={key}
                    onClick={() => onOwnershipChange(key)}
                    style={{
                      ...segmentBtnStyle,
                      ...(active ? segmentBtnActiveStyle : undefined),
                    }}
                    title={
                      key === 'mine'
                        ? 'Only comments you made'
                        : 'Comments from everyone'
                    }
                    type="button"
                  >
                    {key === 'mine' ? 'Mine' : 'Everyone'}
                  </button>
                )
              })}
            </fieldset>
          )}
        </div>
      )}
    </div>
  )
}

function CopyIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      style={{ width: 11, height: 11, flexShrink: 0 }}
      viewBox="0 0 24 24"
    >
      <rect height="13" rx="2" width="13" x="9" y="9" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

const wrapStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  marginBottom: 10,
}

const rowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 6,
}

const chipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '4px 10px',
  borderRadius: 999,
  font: PANEL.font,
  fontSize: 11.5,
  fontWeight: 500,
  background: PANEL.chipBg,
  color: PANEL.muted,
  border: `1px solid ${PANEL.borderSoft}`,
  cursor: 'pointer',
  userSelect: 'none',
}

const chipActiveStyle: CSSProperties = {
  background: PANEL.accentBg,
  borderColor: PANEL.accentBorder,
  color: PANEL.accent,
}

const chipCountStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  padding: '0 5px',
  borderRadius: 999,
  background: PANEL.bg,
  border: `1px solid ${PANEL.borderSoft}`,
  color: PANEL.faint,
}

const chipCountActiveStyle: CSSProperties = {
  color: PANEL.accent,
  borderColor: PANEL.accentBorder,
}

const actionChipStyle: CSSProperties = {
  ...chipStyle,
  marginLeft: 'auto',
  background: 'transparent',
  borderColor: PANEL.border,
}

const segmentStyle: CSSProperties = {
  // <fieldset> (implicit role="group") carries browser defaults that break
  // this inline-flex pill: a groove border, inline margins, and
  // min-inline-size: min-content. Reset them before the real styling.
  border: 'none',
  margin: 0,
  minInlineSize: 0,
  marginLeft: 'auto',
  display: 'inline-flex',
  padding: 2,
  background: PANEL.chipBg,
  borderRadius: 999,
}

const segmentBtnStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  padding: '3px 11px',
  borderRadius: 999,
  font: PANEL.font,
  fontSize: 11.5,
  fontWeight: 500,
  color: PANEL.faint,
  cursor: 'pointer',
  userSelect: 'none',
}

const segmentBtnActiveStyle: CSSProperties = {
  background: PANEL.bg,
  color: PANEL.fg,
  fontWeight: 600,
  boxShadow: '0 1px 2px rgba(0,0,0,.08)',
}
