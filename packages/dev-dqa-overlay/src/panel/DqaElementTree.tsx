import { type CSSProperties, useCallback, useEffect, useState } from 'react'
import type { DqaApi, DqaElementNode } from '../types'
import { PANEL } from './panelTheme'

type DqaElementTreeProps = {
  readonly api: DqaApi | null
}

/**
 * DevTools-style hierarchy of the page's meaningful elements. Hovering a row
 * highlights it on the page (even if invisible/hard to hover); clicking starts
 * a comment anchored to it. Refresh re-reads the live DOM.
 */
export function DqaElementTree({ api }: DqaElementTreeProps) {
  const [tree, setTree] = useState<DqaElementNode[]>([])
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [ready, setReady] = useState(false)

  // useCallback so the identity only changes with `api`: the effect below
  // depends on it, and it is also passed straight to the Refresh button.
  const refresh = useCallback(() => {
    const next = api?.getElementTree?.() ?? []
    setTree(next)
    // Auto-expand the first two levels so the tree is immediately useful.
    const open = new Set<number>()
    const walk = (nodes: readonly DqaElementNode[], depth: number) => {
      for (const n of nodes) {
        if (depth < 1 && n.children.length) open.add(n.uid)
        walk(n.children, depth + 1)
      }
    }
    walk(next, 0)
    setExpanded(open)
    setReady(true)
  }, [api])

  useEffect(() => {
    refresh()
    // `api` is also read directly by the cleanup, so it stays a dependency
    // alongside `refresh` (which only changes when `api` does).
    return () => api?.clearHoverElement?.()
  }, [refresh, api])

  if (!api?.getElementTree) {
    return (
      <p style={mutedStyle}>
        Element navigator needs an up-to-date DQA server. Restart the dqa
        service and hard-refresh.
      </p>
    )
  }

  return (
    <div>
      <div style={headerRowStyle}>
        <span style={mutedStyle}>Page elements</span>
        <button onClick={refresh} style={refreshBtnStyle} type="button">
          ↻ Refresh
        </button>
      </div>
      <div style={treeStyle} onMouseLeave={() => api.clearHoverElement?.()}>
        {ready && tree.length === 0 ? (
          <p style={mutedStyle}>No elements found.</p>
        ) : (
          tree.map((node) => (
            <TreeRow
              api={api}
              depth={0}
              expanded={expanded}
              key={node.uid}
              node={node}
              onToggle={(uid) =>
                setExpanded((prev) => {
                  const next = new Set(prev)
                  next.has(uid) ? next.delete(uid) : next.add(uid)
                  return next
                })
              }
            />
          ))
        )}
      </div>
    </div>
  )
}

type TreeRowProps = {
  readonly api: DqaApi
  readonly node: DqaElementNode
  readonly depth: number
  readonly expanded: Set<number>
  readonly onToggle: (uid: number) => void
}

function TreeRow({ api, node, depth, expanded, onToggle }: TreeRowProps) {
  const hasChildren = node.children.length > 0
  const isOpen = expanded.has(node.uid)
  return (
    <>
      <div
        onClick={() => api.commentOnElement?.(node.uid)}
        onMouseEnter={() => api.hoverElement?.(node.uid)}
        style={{ ...rowStyle, paddingLeft: 6 + depth * 12 }}
        title="Click to comment on this element"
      >
        <button
          aria-label={isOpen ? 'Collapse' : 'Expand'}
          onClick={(e) => {
            e.stopPropagation()
            onToggle(node.uid)
          }}
          style={{
            ...caretStyle,
            visibility: hasChildren ? 'visible' : 'hidden',
          }}
          type="button"
        >
          {isOpen ? '▾' : '▸'}
        </button>
        <span style={node.component ? compStyle : tagStyle}>{node.label}</span>
        <span style={tagDimStyle}>{`<${node.tag}>`}</span>
        {node.hidden && <span style={hiddenBadgeStyle}>hidden</span>}
        {hasChildren && <span style={countStyle}>{node.children.length}</span>}
      </div>
      {isOpen &&
        node.children.map((child) => (
          <TreeRow
            api={api}
            depth={depth + 1}
            expanded={expanded}
            key={child.uid}
            node={child}
            onToggle={onToggle}
          />
        ))}
    </>
  )
}

const headerRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 6,
}

const treeStyle: CSSProperties = {
  maxHeight: '46vh',
  overflow: 'auto',
  border: `1px solid ${PANEL.border}`,
  borderRadius: 8,
  background: PANEL.surface,
  padding: '4px 0',
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '3px 8px 3px 0',
  cursor: 'pointer',
  font: PANEL.font,
  whiteSpace: 'nowrap',
}

const caretStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: PANEL.muted,
  cursor: 'pointer',
  width: 14,
  flexShrink: 0,
  fontSize: 9,
  padding: 0,
}

const compStyle: CSSProperties = {
  color: PANEL.accent,
  fontWeight: 700,
}

const tagStyle: CSSProperties = {
  color: PANEL.fg,
  fontWeight: 600,
}

const tagDimStyle: CSSProperties = {
  color: PANEL.muted,
  fontSize: 10,
}

const countStyle: CSSProperties = {
  color: PANEL.muted,
  fontSize: 10,
  marginLeft: 'auto',
  paddingLeft: 8,
}

const hiddenBadgeStyle: CSSProperties = {
  color: PANEL.muted,
  fontSize: 9,
  border: `1px solid ${PANEL.border}`,
  borderRadius: 3,
  padding: '0 3px',
}

const mutedStyle: CSSProperties = {
  margin: 0,
  color: PANEL.muted,
  font: PANEL.font,
}

const refreshBtnStyle: CSSProperties = {
  border: `1px solid ${PANEL.border}`,
  background: PANEL.surface,
  color: PANEL.accentDense,
  borderRadius: 6,
  padding: '3px 8px',
  font: PANEL.font,
  cursor: 'pointer',
}
