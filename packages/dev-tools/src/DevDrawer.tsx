/**
 * Unified dev/QA tooling — TanStack-style floating trigger beside the router
 * devtools, with a tabbed bottom sheet or right sidebar: one tab per enabled
 * tool (Time Travel, Migration, Design QA, …). The active tab and dock layout
 * persist across reloads.
 */

import {
  createMockDqaApi,
  type DqaApi,
  type DqaAuthConfig,
  DqaPanelContent,
  type DqaUser,
  getDqaTheme,
  isDQAEnabled,
  isDqaMockUiEnabled,
  loadDqaOverlay,
  subscribeDqaTheme,
  toggleDqaTheme,
} from '@ens-apps/dev-dqa-overlay'
import {
  isMigrationToolEnabled,
  MigrationPanelContent,
} from '@ens-apps/dev-migration-tool'
import {
  isTimeTravelEnabled,
  TimeTravelPanelContent,
} from '@ens-apps/dev-time-travel'
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'
import { isDevDrawerEnabled } from './config'
import { DqaAuthButton } from './DqaAuthButton'
import { DRAWER, DRAWER_THEME_VARS } from './drawerTheme'
import { EnsMark } from './EnsMark'
import {
  type DevToolsLayout,
  getDevToolsLayout,
  setDevToolsLayout,
  subscribeDevToolsLayout,
} from './layoutPreference'

// Sit left of the TanStack devtools button in dev. That widget is dev-only
// (renders nothing in production builds), so in QA/PR-preview builds the
// trigger docks hard-right instead of leaving a dead gap.
const TANSTACK_DEVTOOLS_OFFSET = import.meta.env.DEV ? 168 - 10 : 10

const ACTIVE_TAB_KEY = 'ens-devtools:active-tab'

type ToolTab = {
  readonly key: string
  readonly label: string
  readonly accent: string
  readonly content: ReactNode
}

export function DevDrawer() {
  if (!isDevDrawerEnabled()) return null
  return <DevDrawerGate />
}

/**
 * Defer mounting until the app is actually ready — like the TanStack devtools
 * button, which doesn't pop in over a still-loading page. We wait for the load
 * event (if not already fired) plus an idle/settle tick.
 */
function DevDrawerGate() {
  // MUST start `false`, even when the document has already finished loading.
  //
  // Seeding from `document.readyState` made the FIRST client render disagree
  // with the server, which rendered `null` (no `document`): React then hydrated
  // a subtree that was not in the server HTML and threw #418, discarding the
  // whole root -- and because the app calls `hydrateRoot(document, ...)`, that
  // regenerates every provider, aborting any in-flight wallet connect.
  //
  // It only bit production: dev serves an unbundled module graph, so hydration
  // starts long before `load` and the seed was false anyway. A built bundle
  // hydrates from an `async` module script that often runs after `load`, making
  // the seed true. It also only bit preview branches, where `VITE_DQA=1` gives
  // `DevDrawerInner` something to render -- on main it renders nothing, so both
  // sides agreed on empty output by accident.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (ready) return
    let done = false
    const settle = () => {
      if (done) return
      done = true
      const idle =
        (window as { requestIdleCallback?: (cb: () => void) => number })
          .requestIdleCallback ??
        ((cb: () => void) => window.setTimeout(cb, 300))
      idle(() => setReady(true))
    }
    if (document.readyState === 'complete') settle()
    else window.addEventListener('load', settle, { once: true })
    return () => window.removeEventListener('load', settle)
  }, [ready])

  if (!ready) return null
  return <DevDrawerInner />
}

function DevDrawerInner() {
  const [rendered, setRendered] = useState(false)
  const [shown, setShown] = useState(false)
  const [settled, setSettled] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => getDqaTheme())
  const [layout, setLayout] = useState<DevToolsLayout>(() =>
    getDevToolsLayout(),
  )
  const [dqaApi, setDqaApi] = useState<DqaApi | null>(null)
  const [dqaUser, setDqaUser] = useState<DqaUser | null>(null)
  const [dqaAuthenticated, setDqaAuthenticated] = useState(false)
  const [dqaAuthConfig, setDqaAuthConfig] = useState<DqaAuthConfig | null>(null)
  const [dqaSignInError, setDqaSignInError] = useState<string | null>(null)
  const [dqaReady, setDqaReady] = useState(false)
  const [dqaPresence, setDqaPresence] = useState<readonly DqaUser[]>([])
  const [dqaShowPins, setDqaShowPins] = useState(true)
  const isSidebar = layout === 'sidebar'

  useEffect(() => subscribeDqaTheme(setTheme), [])
  useEffect(() => subscribeDevToolsLayout(setLayout), [])
  const [activeKey, setActiveKey] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      return window.localStorage.getItem(ACTIVE_TAB_KEY)
    } catch {
      return null
    }
  })
  const travelEnabled = isTimeTravelEnabled()
  const migrationEnabled = isMigrationToolEnabled()
  const dqaEnabled = isDQAEnabled()

  useEffect(() => {
    if (dqaEnabled && !isDqaMockUiEnabled()) void loadDqaOverlay()
  }, [dqaEnabled])

  // Track DQA auth for the topbar Sign in / profile control.
  useEffect(() => {
    if (!dqaEnabled) {
      setDqaApi(null)
      setDqaUser(null)
      setDqaAuthenticated(false)
      setDqaAuthConfig(null)
      setDqaSignInError(null)
      setDqaReady(false)
      return
    }
    let unsubscribe: (() => void) | undefined
    let cancelled = false

    const apply = (state: {
      user: DqaUser | null
      authenticated: boolean
      authConfig: DqaAuthConfig | null
      signInError: string | null
      ready: boolean
      loading: boolean
      presence?: readonly DqaUser[]
      showPins?: boolean
    }) => {
      setDqaUser(state.user)
      setDqaAuthenticated(state.authenticated)
      setDqaAuthConfig(state.authConfig)
      setDqaSignInError(state.signInError)
      setDqaReady(state.ready && !state.loading)
      setDqaPresence(state.presence ?? [])
      setDqaShowPins(state.showPins !== false)
    }

    const attach = (api: DqaApi) => {
      if (cancelled) return
      setDqaApi(api)
      apply(api.getState())
      unsubscribe = api.subscribe(apply)
      void api.fetchAuthConfig().then((config) => {
        if (!cancelled) setDqaAuthConfig(config)
      })
    }

    if (isDqaMockUiEnabled()) {
      const api = window.__DQA__ ?? createMockDqaApi()
      window.__DQA__ = api
      attach(api)
    } else {
      void loadDqaOverlay()
        .then(attach)
        .catch(() => {})
    }

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [dqaEnabled])

  // Close the drawer when DQA comment mode turns on so the reviewer sees the
  // full page while picking an element (only reacts to the transition).
  useEffect(() => {
    if (!dqaEnabled || !rendered || !dqaApi) return
    let prev = dqaApi.getState().commentMode
    return dqaApi.subscribe((state) => {
      if (state.commentMode && !prev) setShown(false)
      prev = state.commentMode
    })
  }, [dqaEnabled, rendered, dqaApi])

  useEffect(() => {
    if (!rendered) {
      setSettled(false)
      return
    }
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setShown(true)),
    )
    return () => cancelAnimationFrame(id)
  }, [rendered])

  useEffect(() => {
    if (!shown) setSettled(false)
  }, [shown])

  const panelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!rendered) return
    const panel = panelRef.current
    if (!panel) return
    const body = document.body
    const previousPaddingBottom = body.style.paddingBottom
    const previousPaddingRight = body.style.paddingRight
    const apply = () => {
      const rect = panel.getBoundingClientRect()
      if (isSidebar) {
        body.style.paddingRight = `${rect.width}px`
        body.style.paddingBottom = previousPaddingBottom
      } else {
        body.style.paddingBottom = `${rect.height}px`
        body.style.paddingRight = previousPaddingRight
      }
    }
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(panel)
    return () => {
      observer.disconnect()
      body.style.paddingBottom = previousPaddingBottom
      body.style.paddingRight = previousPaddingRight
    }
  }, [rendered, isSidebar])

  const tabs: ToolTab[] = []

  if (travelEnabled) {
    tabs.push({
      key: 'time-travel',
      label: 'Time travel',
      accent: DRAWER.accent,
      content: <TimeTravelPanelContent />,
    })
  }

  if (migrationEnabled) {
    tabs.push({
      key: 'migration',
      label: 'Migration',
      accent: '#e7a259', // ens-citrine-400
      content: <MigrationPanelContent />,
    })
  }

  if (dqaEnabled) {
    tabs.push({
      key: 'dqa',
      label: 'Design QA',
      accent: '#f53293', // ens-garnet-core (brand magenta)
      content: <DqaPanelContent />,
    })
  }

  const fallbackTab = tabs[0]
  if (!fallbackTab) return null

  const active = tabs.find((tab) => tab.key === activeKey) ?? fallbackTab

  const selectTab = (key: string) => {
    setActiveKey(key)
    try {
      window.localStorage.setItem(ACTIVE_TAB_KEY, key)
    } catch {}
  }

  const toolTabs = (
    <div
      style={{
        ...tabsRowStyle,
        ...(isSidebar ? sidebarTabsRowStyle : undefined),
      }}
      role="tablist"
      aria-label="Dev tools"
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active.key
        return (
          <button
            aria-selected={isActive}
            key={tab.key}
            onClick={() => selectTab(tab.key)}
            role="tab"
            style={{
              ...tabStyle,
              ...(isActive
                ? {
                    background: DRAWER.accentBg,
                    borderColor: DRAWER.accentBorder,
                    color: DRAWER.fg,
                    fontWeight: 600,
                  }
                : undefined),
            }}
            type="button"
          >
            <span
              aria-hidden
              style={{ ...tabDotStyle, background: tab.accent }}
            />
            {tab.label}
            <span aria-hidden style={tabChevronStyle}>
              ›
            </span>
          </button>
        )
      })}
    </div>
  )

  const headerUtils = (
    <div style={headerActionsStyle}>
      {dqaEnabled && (
        <DqaAuthButton
          api={dqaApi}
          authenticated={dqaAuthenticated}
          devAllowed={!!dqaAuthConfig?.devAllowed}
          oauthConfigured={!!dqaAuthConfig?.oauthConfigured}
          ready={dqaReady}
          signInError={dqaSignInError}
          user={dqaUser}
        />
      )}
      <button
        aria-label={
          isSidebar
            ? 'Switch to bottom sheet layout'
            : 'Switch to sidebar layout'
        }
        onClick={() => setDevToolsLayout(isSidebar ? 'bottom' : 'sidebar')}
        style={{
          ...headerBtnStyle,
          ...(isSidebar ? headerBtnActiveStyle : undefined),
        }}
        title={
          isSidebar
            ? 'Layout: sidebar — click for bottom sheet'
            : 'Layout: bottom — click for sidebar'
        }
        type="button"
      >
        {isSidebar ? <IconPanelBottom /> : <IconPanelRight />}
      </button>
      <button
        aria-label={
          theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
        }
        onClick={() => toggleDqaTheme()}
        style={headerBtnStyle}
        title={`Theme: ${theme} — click to switch`}
        type="button"
      >
        {theme === 'dark' ? <IconSun /> : <IconMoon />}
      </button>
      {!isSidebar && (
        <button
          aria-label={expanded ? 'Shrink dev tools' : 'Expand dev tools'}
          onClick={() => setExpanded((value) => !value)}
          style={headerBtnStyle}
          title={expanded ? 'Shrink' : 'Expand'}
          type="button"
        >
          {expanded ? '⌄' : '⌃'}
        </button>
      )}
      <button
        aria-label="Close dev tools"
        onClick={() => setShown(false)}
        style={headerBtnStyle}
        type="button"
      >
        ✕
      </button>
    </div>
  )

  return (
    <>
      {rendered && (
        <section
          data-dqa-ignore=""
          ref={panelRef}
          onTransitionEnd={(event) => {
            if (event.propertyName !== 'transform') return
            if (!shown) setRendered(false)
            else setSettled(true)
          }}
          style={{
            ...(isSidebar ? sidebarPanelStyle : panelStyle),
            ...DRAWER_THEME_VARS[theme],
            ...(isSidebar
              ? { width: SIDEBAR_WIDTH }
              : { height: expanded ? '85vh' : PANEL_HEIGHT }),
            transform: shown
              ? settled
                ? 'none'
                : isSidebar
                  ? 'translateX(0)'
                  : 'translateY(0)'
              : isSidebar
                ? 'translateX(100%)'
                : 'translateY(100%)',
          }}
          aria-label="ENS dev tools"
        >
          <div style={panelHeaderStyle}>
            <div style={panelBrandStyle}>
              <span aria-hidden style={panelBrandLogoStyle}>
                <EnsMark size={13} style={{ color: 'currentColor' }} />
              </span>
              <span style={panelBrandTitleStyle}>Dev tools</span>
            </div>
            {headerUtils}
          </div>
          <div style={tabContentStyle} role="tabpanel">
            {toolTabs}
            <div style={activeToolStyle}>{active.content}</div>
          </div>
        </section>
      )}

      {!rendered && (
        <button
          aria-expanded={rendered}
          aria-label="Open ENS dev tools"
          data-dqa-ignore=""
          onClick={() => setRendered(true)}
          style={{ ...toggleStyle, ...DRAWER_THEME_VARS[theme] }}
          type="button"
        >
          <EnsMark size={14} style={{ color: 'currentColor', flexShrink: 0 }} />
          <span style={toggleLabelStyle}>Dev tools</span>
          {dqaPresence.length > 0 ? (
            // Live viewers (max 3 avatars + "N viewing"); full list is in the
            // open DQA toolbar.
            <span
              style={togglePresenceStyle}
              title={`${dqaPresence.length} viewing: ${dqaPresence.map((p) => p.name).join(', ')}`}
            >
              <span style={triggerAvatarsStyle}>
                {dqaPresence.slice(0, 3).map((p, i) => (
                  <span
                    key={p.id}
                    style={{
                      ...triggerAvatarStyle,
                      background: p.color ?? '#6b7280',
                      marginLeft: i === 0 ? 0 : -5,
                    }}
                  >
                    {(p.name || '?').slice(0, 1).toUpperCase()}
                  </span>
                ))}
              </span>
              {dqaPresence.length > 3 && (
                <span style={triggerMoreStyle}>+{dqaPresence.length - 3}</span>
              )}
            </span>
          ) : (
            <span style={toggleDotsStyle}>
              {tabs.map((tab) => (
                <span
                  key={tab.key}
                  style={{ ...statusDotStyle, background: tab.accent }}
                />
              ))}
            </span>
          )}
          {dqaAuthenticated && dqaApi?.setShowPins && (
            // Quick pins toggle without opening the drawer. A span (not a
            // nested <button>) because it sits inside the trigger button.
            // biome-ignore lint/a11y/useSemanticElements: a <button> here would nest inside the trigger <button>, which is invalid HTML
            <span
              onClick={(event) => {
                event.stopPropagation()
                dqaApi.setShowPins?.(!dqaShowPins)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  event.stopPropagation()
                  dqaApi.setShowPins?.(!dqaShowPins)
                }
              }}
              role="button"
              style={triggerEyeStyle}
              tabIndex={0}
              title={
                dqaShowPins
                  ? 'Hide comment bubbles on the page'
                  : 'Show comment bubbles on the page'
              }
            >
              <TriggerEyeIcon off={!dqaShowPins} />
            </span>
          )}
        </button>
      )}
    </>
  )
}

function TriggerEyeIcon({ off }: { readonly off?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      style={{ width: 12, height: 12, display: 'block' }}
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

function IconPanelRight() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height="14"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 16 16"
      width="14"
    >
      <title>Sidebar layout</title>
      <rect height="12" rx="1.5" width="12" x="2" y="2" />
      <path d="M10 2v12" />
    </svg>
  )
}

function IconPanelBottom() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height="14"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 16 16"
      width="14"
    >
      <title>Bottom layout</title>
      <rect height="12" rx="1.5" width="12" x="2" y="2" />
      <path d="M2 10h12" />
    </svg>
  )
}

function IconSun() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height="14"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 16 16"
      width="14"
    >
      <title>Light theme</title>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1" />
    </svg>
  )
}

function IconMoon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height="14"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 16 16"
      width="14"
    >
      <title>Dark theme</title>
      <path d="M13.5 9.2A5.5 5.5 0 0 1 6.8 2.5 5.5 5.5 0 1 0 13.5 9.2Z" />
    </svg>
  )
}

const Z_PANEL = 2_147_483_640
const Z_TOGGLE = 2_147_483_645

const PANEL_HEIGHT = 'min(52vh, 520px)'
const SIDEBAR_WIDTH = 'min(380px, 100vw)'

const panelStyle: CSSProperties = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: Z_PANEL,
  // A Radix modal Dialog (portal's TransactionModal) sets
  // `body { pointer-events: none }` while open, which children inherit — the
  // drawer would render on top but swallow every click. Opt back in so dev
  // tools (e.g. time-travel Skip+70s during the commit cooldown) stay usable.
  pointerEvents: 'auto',
  display: 'flex',
  flexDirection: 'column',
  background: DRAWER.bg,
  color: DRAWER.fg,
  font: DRAWER.font,
  fontSize: 13,
  borderTop: `1px solid ${DRAWER.border}`,
  boxShadow:
    '0 -1px 2px rgba(0,0,0,.04), 0 -8px 24px rgba(0,0,0,.10), 0 -24px 48px rgba(0,0,0,.08)',
  transition: 'transform 0.22s ease-out, height 0.15s ease-out',
}

const sidebarPanelStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  zIndex: Z_PANEL,
  pointerEvents: 'auto', // see panelStyle
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  background: DRAWER.bg,
  color: DRAWER.fg,
  font: DRAWER.font,
  fontSize: 13,
  borderLeft: `1px solid ${DRAWER.border}`,
  boxShadow:
    '-1px 0 2px rgba(0,0,0,.04), -8px 0 24px rgba(0,0,0,.10), -24px 0 48px rgba(0,0,0,.08)',
  transition: 'transform 0.22s ease-out, width 0.15s ease-out',
}

const panelHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '12px 14px',
  borderBottom: `1px solid ${DRAWER.borderSoft}`,
  background: DRAWER.bg,
  flexShrink: 0,
}

const panelBrandStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexShrink: 0,
}

const panelBrandLogoStyle: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 6,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: DRAWER.primary,
  color: DRAWER.onPrimary,
  flexShrink: 0,
}

const panelBrandTitleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: DRAWER.fg,
  letterSpacing: '-0.01em',
}

const tabsRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 4,
  flexShrink: 0,
  marginBottom: 10,
  paddingBottom: 10,
  borderBottom: `1px solid ${DRAWER.borderSoft}`,
}

const sidebarTabsRowStyle: CSSProperties = {
  flexDirection: 'column',
  alignItems: 'stretch',
  flexWrap: 'nowrap',
}

const tabStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '7px 10px',
  borderRadius: 8,
  border: `1px solid transparent`,
  background: 'transparent',
  color: DRAWER.muted,
  font: DRAWER.font,
  fontSize: 12.5,
  fontWeight: 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  userSelect: 'none',
  textAlign: 'left',
}

const tabDotStyle: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: '50%',
  flexShrink: 0,
}

const tabChevronStyle: CSSProperties = {
  marginLeft: 'auto',
  color: DRAWER.faint,
  fontSize: 11,
  paddingLeft: 6,
}

const headerActionsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  flexShrink: 0,
}

const headerBtnStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  background: 'transparent',
  color: DRAWER.faint,
  borderRadius: 7,
  width: 26,
  height: 26,
  padding: 0,
  cursor: 'pointer',
  fontSize: 12,
  lineHeight: 1,
}

const headerBtnActiveStyle: CSSProperties = {
  background: DRAWER.chipBg,
  color: DRAWER.fg,
}

const tabContentStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
  padding: '12px 14px 14px',
  display: 'flex',
  flexDirection: 'column',
}

const activeToolStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
}

const toggleStyle: CSSProperties = {
  position: 'fixed',
  bottom: 7,
  right: TANSTACK_DEVTOOLS_OFFSET,
  zIndex: Z_TOGGLE,
  pointerEvents: 'auto', // see panelStyle
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '7px 12px 7px 8px',
  borderRadius: 6,
  background: DRAWER.handleBg,
  color: DRAWER.handleFg,
  border: `1px solid ${DRAWER.borderStrong}`,
  boxShadow: '0 2px 8px rgba(9, 60, 82, 0.24)',
  cursor: 'pointer',
  userSelect: 'none',
  whiteSpace: 'nowrap',
  font: `600 ${DRAWER.font}`,
}

const toggleLabelStyle: CSSProperties = {
  fontWeight: 600,
  letterSpacing: '-0.01em',
}

const toggleDotsStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  marginLeft: 2,
}

const statusDotStyle: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: '50%',
  flexShrink: 0,
}

const togglePresenceStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  marginLeft: 2,
}

const triggerEyeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 3,
  marginLeft: 2,
  borderRadius: 5,
  color: 'currentColor',
  opacity: 0.75,
  cursor: 'pointer',
}

const triggerAvatarsStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
}

const triggerAvatarStyle: CSSProperties = {
  width: 16,
  height: 16,
  borderRadius: '50%',
  marginLeft: -5,
  border: '1.5px solid var(--dt-handle-bg)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#fff',
  fontSize: 8,
  fontWeight: 700,
  flexShrink: 0,
  lineHeight: 1,
  userSelect: 'none',
}

const triggerMoreStyle: CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  opacity: 0.85,
}
