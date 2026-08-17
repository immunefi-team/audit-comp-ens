import { type CSSProperties, useCallback, useEffect, useState } from 'react'
import type { DqaApi, DqaPageSummary } from '../types'
import { PANEL } from './panelTheme'

type DqaPagesListProps = {
  readonly api: DqaApi | null
  readonly currentUrl?: string
}

/**
 * Every page (route) that has DQA comments, with open/total counts. Comments
 * are scoped per page, so this is how you find and jump to feedback on other
 * routes. Clicking a page navigates there (full same-origin navigation).
 */
export function DqaPagesList({ api, currentUrl }: DqaPagesListProps) {
  const [pages, setPages] = useState<DqaPageSummary[]>([])
  const [loading, setLoading] = useState(true)

  // useCallback so the identity only changes with `api`: the effect below
  // depends on it, and it is also passed straight to the Refresh button.
  const refresh = useCallback(() => {
    if (!api?.getPages) {
      setLoading(false)
      return
    }
    setLoading(true)
    void api.getPages().then((list) => {
      setPages(list)
      setLoading(false)
    })
  }, [api])

  useEffect(() => {
    refresh()
  }, [refresh])

  if (!api?.getPages) {
    return (
      <p style={mutedStyle}>
        Pages navigator needs an up-to-date DQA server. Restart the dqa service
        and hard-refresh.
      </p>
    )
  }

  const short = (url: string) => {
    try {
      return new URL(url).pathname || '/'
    } catch {
      return url
    }
  }

  return (
    <div>
      <div style={headerRowStyle}>
        <span style={mutedStyle}>Pages with comments</span>
        <button onClick={refresh} style={refreshBtnStyle} type="button">
          ↻ Refresh
        </button>
      </div>
      {loading ? (
        <p style={mutedStyle}>Loading…</p>
      ) : pages.length === 0 ? (
        <p style={mutedStyle}>No comments on any page yet.</p>
      ) : (
        <div style={listStyle}>
          {pages.map((page) => {
            const isCurrent = page.url === currentUrl
            return (
              <div
                key={page.url}
                onClick={() => !isCurrent && api.navigateTo?.(page.url)}
                style={{
                  ...rowStyle,
                  ...(isCurrent ? currentRowStyle : undefined),
                }}
                title={isCurrent ? 'Current page' : `Go to ${page.url}`}
              >
                <span style={pathStyle}>{short(page.url)}</span>
                {isCurrent && <span style={hereBadgeStyle}>here</span>}
                <span style={countStyle}>
                  {page.open} open · {page.total}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const headerRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 6,
}

const listStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  maxHeight: '46vh',
  overflow: 'auto',
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 10px',
  borderRadius: 8,
  border: `1px solid ${PANEL.border}`,
  background: PANEL.surface,
  cursor: 'pointer',
  font: PANEL.font,
}

const currentRowStyle: CSSProperties = {
  borderColor: PANEL.accent,
  background: PANEL.accentBg,
  cursor: 'default',
}

const pathStyle: CSSProperties = {
  color: PANEL.fg,
  fontWeight: 600,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const hereBadgeStyle: CSSProperties = {
  color: PANEL.accentDense,
  fontSize: 9,
  border: `1px solid ${PANEL.borderStrong}`,
  borderRadius: 3,
  padding: '0 4px',
}

const countStyle: CSSProperties = {
  marginLeft: 'auto',
  color: PANEL.muted,
  fontSize: 10,
  whiteSpace: 'nowrap',
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
