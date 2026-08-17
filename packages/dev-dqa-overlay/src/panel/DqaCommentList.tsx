import type { CSSProperties } from 'react'
import type { DqaCommentSummary } from '../types'
import { DqaCommentCard } from './DqaCommentCard'
import { PANEL } from './panelTheme'

type DqaCommentListProps = {
  readonly comments: readonly DqaCommentSummary[]
  readonly activeCommentId: string | null
  readonly filter: import('./DqaCommentFilters').CommentFilter
  readonly onFocus: (id: string) => void
  readonly onResolve?: (id: string) => void
  readonly onDelete?: (id: string) => void
  readonly onCopyMarkdown?: (id: string) => Promise<boolean>
  readonly showFocusAction?: boolean
}

export function DqaCommentList({
  comments,
  activeCommentId,
  filter,
  onFocus,
  onResolve,
  onDelete,
  onCopyMarkdown,
  showFocusAction = true,
}: DqaCommentListProps) {
  const filtered = comments.filter((comment) => {
    if (filter === 'all') return true
    return comment.status === filter
  })

  if (filtered.length === 0) {
    return (
      <div style={emptyStyle}>
        {filter === 'open'
          ? 'No open comments — click Comment and pick an element on the page.'
          : `No ${filter === 'resolved' ? 'resolved' : ''} comments yet.`}
      </div>
    )
  }

  return (
    <div style={listStyle}>
      {filtered.map((comment) => (
        <DqaCommentCard
          active={comment.id === activeCommentId}
          comment={comment}
          key={comment.id}
          onFocus={() => onFocus(comment.id)}
          onResolve={onResolve ? () => onResolve(comment.id) : undefined}
          onDelete={onDelete ? () => onDelete(comment.id) : undefined}
          onCopyMarkdown={
            onCopyMarkdown ? () => onCopyMarkdown(comment.id) : undefined
          }
          showFocusAction={showFocusAction}
        />
      ))}
    </div>
  )
}

const listStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

const emptyStyle: CSSProperties = {
  padding: '40px 20px',
  textAlign: 'center',
  color: PANEL.faint,
  font: PANEL.fontSans,
  fontSize: 12.5,
  border: `1px dashed ${PANEL.border}`,
  borderRadius: 10,
  background: PANEL.surface,
}
