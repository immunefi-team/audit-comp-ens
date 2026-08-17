/**
 * DQA controls for the unified DevDrawer. Loads overlay.js in embed mode and
 * drives comment mode via `window.__DQA__`. Auth lives in the Dev tools topbar.
 * Pins, cursors, and popovers remain in the overlay script's full-viewport
 * shadow root.
 */

import { type CSSProperties, useState } from 'react'
import { copyText } from './panel/copyText'
import {
  type CommentFilter,
  type CommentOwnership,
  DqaCommentFilters,
} from './panel/DqaCommentFilters'
import { DqaCommentList } from './panel/DqaCommentList'
import { DqaElementTree } from './panel/DqaElementTree'
import { DqaPagesList } from './panel/DqaPagesList'
import { DqaPreviewBanner } from './panel/DqaPreviewBanner'
import { DqaToolbar } from './panel/DqaToolbar'
import { PANEL } from './panel/panelTheme'
import { useDqaPanel } from './panel/useDqaPanel'

type PanelView = 'comments' | 'elements' | 'pages'

export function DqaPanelContent() {
  const { state, api, loadError, isMockMode } = useDqaPanel()
  const [filter, setFilter] = useState<CommentFilter>('open')
  const [ownership, setOwnership] = useState<CommentOwnership>('all')
  const [view, setView] = useState<PanelView>('comments')

  if (!state.ready || state.loading) {
    return <p style={mutedStyle}>Loading DQA…</p>
  }

  const showToolbar = state.authenticated || isMockMode
  const canInteract = !!(api && (state.authenticated || isMockMode))

  const handleFocus = (id: string) => {
    api?.focusComment(id)
  }

  // Ownership filter: "Mine" narrows to comments authored by the signed-in
  // reviewer (matched on the session user id).
  const visibleComments =
    ownership === 'mine' && state.user
      ? state.comments.filter((c) => c.authorId === state.user?.id)
      : state.comments

  return (
    <div style={rootStyle}>
      {loadError && (
        <p style={warnStyle}>
          DQA server unavailable — {loadError}. Start the dqa service on port
          4000 and hard-refresh.
        </p>
      )}

      {!showToolbar && !loadError && (
        <p style={mutedStyle}>
          Sign in from the Dev tools header to leave and review comments.
        </p>
      )}

      {isMockMode && <DqaPreviewBanner message="Mock UI — sample data" />}

      {showToolbar && (
        <DqaToolbar
          onToggleCommentMode={() => api?.setCommentMode(!state.commentMode)}
          onToggleHighlightAll={
            canInteract && api?.setHighlightAll
              ? () => api.setHighlightAll?.(!state.outlineAll)
              : undefined
          }
          onTogglePins={
            canInteract && api?.setShowPins
              ? () => api.setShowPins?.(!(state.showPins !== false))
              : undefined
          }
          showCommentMode={canInteract}
          state={state}
        />
      )}

      {canInteract && api?.getElementTree && (
        <div style={viewToggleStyle} role="tablist" aria-label="Panel view">
          {(['comments', 'elements', 'pages'] as const).map((v) => (
            <button
              aria-selected={view === v}
              key={v}
              onClick={() => setView(v)}
              role="tab"
              style={{
                ...viewTabStyle,
                ...(view === v ? viewTabActiveStyle : undefined),
              }}
              type="button"
            >
              {v === 'comments' ? (
                <>
                  Comments{' '}
                  <span style={viewTabCountStyle}>
                    {visibleComments.length}
                  </span>
                </>
              ) : v === 'elements' ? (
                'Elements'
              ) : (
                'Pages'
              )}
            </button>
          ))}
        </div>
      )}

      <div style={scrollBodyStyle}>
        {view === 'pages' ? (
          <DqaPagesList api={api} currentUrl={state.pageUrl} />
        ) : view === 'elements' ? (
          <DqaElementTree api={api} />
        ) : (
          <>
            <DqaCommentFilters
              comments={visibleComments}
              filter={filter}
              onFilterChange={setFilter}
              onOwnershipChange={state.user ? setOwnership : undefined}
              onToggleResolvedPins={
                api?.setShowResolved
                  ? () => api.setShowResolved?.(!state.showResolved)
                  : undefined
              }
              ownership={ownership}
              showResolvedPins={state.showResolved ?? false}
              onCopyAllMarkdown={
                api?.getAllCommentsMarkdown
                  ? async () => {
                      const md = api.getAllCommentsMarkdown?.()
                      return md ? copyText(md) : false
                    }
                  : undefined
              }
            />

            <DqaCommentList
              activeCommentId={state.activeCommentId}
              comments={visibleComments}
              filter={filter}
              onFocus={handleFocus}
              onResolve={
                canInteract && api?.resolveComment
                  ? (id) => void api.resolveComment?.(id)
                  : undefined
              }
              onDelete={
                canInteract && api?.deleteComment
                  ? (id) => {
                      if (
                        window.confirm(
                          'Delete this DQA comment? (does not touch Linear)',
                        )
                      ) {
                        void api.deleteComment?.(id)
                      }
                    }
                  : undefined
              }
              onCopyMarkdown={
                api?.getCommentMarkdown
                  ? async (id) => {
                      const md = api.getCommentMarkdown?.(id)
                      return md ? copyText(md) : false
                    }
                  : undefined
              }
              showFocusAction={canInteract}
            />
          </>
        )}
      </div>
    </div>
  )
}

const viewToggleStyle: CSSProperties = {
  display: 'flex',
  marginBottom: 10,
  borderBottom: `1px solid ${PANEL.borderSoft}`,
  background: 'transparent',
}

const viewTabStyle: CSSProperties = {
  flex: 1,
  textAlign: 'center',
  border: 'none',
  borderBottom: '2px solid transparent',
  background: 'transparent',
  color: PANEL.faint,
  padding: '9px 0',
  font: PANEL.font,
  fontWeight: 500,
  cursor: 'pointer',
  userSelect: 'none',
}

const viewTabActiveStyle: CSSProperties = {
  borderBottomColor: PANEL.primary,
  color: PANEL.fg,
  fontWeight: 600,
}

const viewTabCountStyle: CSSProperties = {
  color: PANEL.faint,
  fontWeight: 500,
}

const rootStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
}

const scrollBodyStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
  display: 'flex',
  flexDirection: 'column',
}

const mutedStyle: CSSProperties = {
  margin: 0,
  color: PANEL.muted,
  font: PANEL.font,
}

const warnStyle: CSSProperties = {
  ...mutedStyle,
  color: PANEL.error,
  marginBottom: 8,
  maxWidth: 520,
}
