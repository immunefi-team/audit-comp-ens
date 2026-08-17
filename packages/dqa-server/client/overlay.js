/* DQA Overlay — inject on any page with:
 *   <script type="module" src="http://localhost:4000/overlay.js?issue=ENG-123"></script>
 * Legacy mode: floating sign-in card + toolbar (demo.html, manual embed).
 * DevDrawer mode: set window.__DQA_EMBED__ = "drawer" or add ?embed=drawer to the
 * src — only pins, cursors, and comment popovers render; auth UI lives in DevDrawer.
 *
 * This is an ES module, bundled by Vite (see vite.config.ts) into ../dist.
 * Config comes from the module's own URL rather than the script element:
 * `document.currentScript` is always null in module scripts (per spec), so
 * `import.meta.url` is the only way to recover where we were loaded from.
 */
;(() => {
  if (window.__DQA_OVERLAY__) {
    if (window.__DQA__) return
    document.getElementById('dqa-overlay-host')?.remove()
    delete window.__DQA_OVERLAY__
  }
  window.__DQA_OVERLAY__ = true

  // Where this module was served from — the DQA server. Config rides on the
  // URL's query string because module scripts have no `document.currentScript`
  // to read data-* attributes off of.
  const SELF_URL = new URL(import.meta.url)
  const API = SELF_URL.origin
  // Auth origin — same as API unless /auth/config reports a delegated
  // `authOrigin` (long-lived instance owning the Linear OAuth redirect URI).
  let AUTH = API
  const WS_URL = API.replace(/^http/, 'ws') + '/ws'
  // Comments are scoped per page. In a SPA the route changes without a reload,
  // so PAGE_URL must be recomputed on every navigation (see the history hooks
  // near the bottom) — never cached as a constant.
  let PAGE_URL = location.origin + location.pathname
  const ISSUE_REF = SELF_URL.searchParams.get('issue') // e.g. "ENG-123"
  /** DevDrawer embed — legacy floating sign-in/toolbar disabled. */
  const EMBED =
    window.__DQA_EMBED__ === 'drawer' ||
    SELF_URL.searchParams.get('embed') === 'drawer'

  let TOKEN = null
  try {
    TOKEN = localStorage.getItem('dqa_token')
  } catch {}
  let USER = null

  // ---- shadow-root host -------------------------------------------------
  const host = document.createElement('div')
  host.id = 'dqa-overlay-host'
  // Above the host app, but BELOW the DevDrawer sheet (z 2147483640) and its
  // trigger (z 2147483645) — pins/cursors/popovers must never cover the drawer.
  host.style.cssText =
    'all:initial;position:fixed;inset:0;z-index:2147483600;pointer-events:none;'
  document.documentElement.appendChild(host)
  const root = host.attachShadow({ mode: 'open' })

  root.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        -webkit-font-smoothing: antialiased; }
      /* ENS brand palette — quartz neutrals, lapis accent, signal danger.
         dark theme (default) */
      :host { --ink:#f4f4f4; --muted:#a1a1a1; --line:#333333; --surface:#191919; --subtle:#262625; --accent:#39b4ea;
        --pin-bg:#191919; --pin-fg:#ffffff; --btn-bg:#f4f4f4; --btn-fg:#191919; --danger:#ffb3ac; --success:#1cbf46; }
      :host(.light) { --ink:#191919; --muted:#595755; --line:#e1e1e0; --surface:#fff; --subtle:#faf9f7; --accent:#0080bc;
        --pin-bg:#191919; --pin-fg:#ffffff; --btn-bg:#191919; --btn-fg:#ffffff; --danger:#b42013; --success:#007c23; }
      /* Every avatar variant (pins, thread messages, presence, cursors):
         line-height 1 keeps initials optically centered; images fill. */
      .av, .avatar, .pin-av, .pin-letter { line-height: 1; user-select: none; text-align: center; }
      .av img, .avatar img, .pin-av img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .layer { position: fixed; inset: 0; pointer-events: none; }
      .hl { position: absolute; pointer-events: none; border: 1.5px solid var(--accent);
        border-radius: 4px; background: rgba(0,128,188,.06); transition: all .04s linear; display: none; }
      .hl-label { position: absolute; left: 0; top: -20px; font-size: 11px; font-weight: 600;
        color: #fff; background: var(--accent); padding: 1px 6px; border-radius: 4px; white-space: nowrap; }
      /* Pin = a cluster of up to 3 participant avatars (author + repliers). */
      .pin { position: absolute; margin-top: -28px; display: flex; align-items: center;
        cursor: pointer; pointer-events: auto; padding: 0; }
      .pin .pin-av { width: 28px; height: 28px; border-radius: 50%; overflow: hidden; flex-shrink: 0;
        border: 1.5px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.25); margin-left: -10px;
        display: flex; align-items: center; justify-content: center; position: relative; }
      /* The first avatar keeps the classic comment-marker shape (circle with a
         pointed bottom-left corner) so pins still read as "a comment here". */
      .pin .pin-av:first-child { margin-left: 0; border-radius: 50% 50% 50% 2px; }
      .pin .pin-av img { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }
      .pin .pin-letter { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
        font-size: 11px; font-weight: 700; color: #fff; text-transform: uppercase; line-height: 1; user-select: none; }
      .pin .pin-more { width: 22px; height: 28px; margin-left: -8px; display: flex; align-items: center;
        justify-content: center; font-size: 10px; font-weight: 700; color: var(--pin-fg); }
      .pin.resolved { opacity: 0.72; }
      .pin.resolved::after { content: '✓'; position: absolute; right: -4px; bottom: -2px; width: 13px; height: 13px;
        border-radius: 50%; background: var(--surface); color: var(--muted); border: 1px solid var(--line);
        font-size: 8px; font-weight: 700; display: flex; align-items: center; justify-content: center; line-height: 1; }
      .cursor { position: absolute; pointer-events: none; transition: transform .06s linear; }
      .cursor svg { display: block; filter: drop-shadow(0 1px 1px rgba(0,0,0,.25)); }
      .cursor .tag { position: absolute; left: 13px; top: 13px; white-space: nowrap;
        font-size: 11px; font-weight: 600; color: #fff; padding: 1px 6px; border-radius: 4px; }
      .toolbar { position: fixed; bottom: 18px; right: 18px; pointer-events: auto;
        background: var(--surface); color: var(--ink); border: 1px solid var(--line); border-radius: 10px;
        padding: 6px; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 16px rgba(0,0,0,.08); }
      .toolbar .mode { all: unset; cursor: pointer; font-size: 13px; font-weight: 600; padding: 7px 12px;
        border-radius: 7px; color: var(--ink); background: var(--subtle); display: flex; align-items: center; gap: 6px; }
      .toolbar .mode.active { background: var(--ink); color: #fff; }
      .presence { display: flex; align-items: center; padding-left: 2px; }
      .avatar { width: 22px; height: 22px; border-radius: 50%; margin-left: -5px; border: 2px solid var(--surface);
        display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: #fff;
        overflow: hidden; flex-shrink: 0; line-height: 1; user-select: none; }
      .avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .count { font-size: 12px; color: var(--muted); padding: 0 6px; }
      .icon-btn { all: unset; cursor: pointer; color: var(--muted); font-size: 12px; padding: 6px; border-radius: 6px; }
      .icon-btn:hover { background: var(--subtle); color: var(--ink); }
      .popover { position: absolute; pointer-events: auto; width: 348px; background: var(--surface); color: var(--ink);
        border-radius: 10px; box-shadow: 0 8px 28px rgba(0,0,0,.16); border: 1px solid var(--line); overflow: hidden;
        max-height: 85vh; display: flex; flex-direction: column; }
      .popover .head { padding: 10px 12px; border-bottom: 1px solid var(--line); font-size: 12px; color: var(--muted);
        display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
      /* default body: scroll the whole body within the capped popover (compose) */
      .popover .body { flex: 1; min-height: 0; overflow-y: auto; }
      /* thread body: messages+summaries scroll, reply+actions stay pinned */
      .popover .body.body-thread { overflow: hidden; display: flex; flex-direction: column; }
      .body-thread .context { flex-shrink: 0; max-height: 34%; overflow-y: auto; }
      .body-thread .thread-scroll { flex: 1; min-height: 60px; overflow-y: auto; }
      .body-thread .reply-area { flex-shrink: 0; border-top: 1px solid var(--line); padding-top: 8px; margin-top: 8px; }
      .body-thread .reply-area .row.actions { margin-top: 8px; padding-top: 0; border-top: none; }
      .popover .head .sel { font-family: ui-monospace, monospace; color: var(--ink); max-width: 190px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; text-align: right; }
      .popover .head .head-x { all: unset; cursor: pointer; margin-left: 8px; color: var(--muted);
        font-size: 12px; line-height: 1; padding: 3px 5px; border-radius: 5px; flex-shrink: 0; }
      .popover .head .head-x:hover { background: var(--subtle); color: var(--ink); }
      .popover .body { padding: 12px; }
      .row.actions { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--line); }
      .thread { display: flex; flex-direction: column; gap: 12px; padding: 2px 0; }
      .msg { display: flex; gap: 8px; align-items: flex-start; }
      .msg .av { flex-shrink: 0; width: 26px; height: 26px; border-radius: 50%; display: flex;
        align-items: center; justify-content: center; color: #fff; font-size: 11px; font-weight: 700;
        text-transform: uppercase; margin-top: 1px; overflow: hidden; line-height: 1; user-select: none; }
      .msg .av img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .msg .bubble { flex: 1; min-width: 0; }
      .msg .meta { display: flex; align-items: baseline; gap: 6px; margin-bottom: 2px; }
      .msg .who { font-size: 12px; font-weight: 700; color: var(--ink); }
      .msg .when { font-size: 10px; color: var(--muted); }
      .msg .txt { font-size: 13px; white-space: pre-wrap; line-height: 1.45; word-wrap: break-word; }
      .msg.first .txt { background: var(--subtle); border: 1px solid var(--line); border-radius: 8px; padding: 7px 9px; }
      .msg img { max-width: 100%; border-radius: 6px; margin-top: 6px; }
      textarea { width: 100%; min-height: 58px; border: 1px solid var(--line); border-radius: 8px; padding: 8px;
        font-size: 13px; resize: vertical; font-family: inherit; color: var(--ink); background: var(--subtle); }
      textarea:focus { outline: none; border-color: var(--accent); }
      .row { display: flex; gap: 8px; align-items: center; margin-top: 8px; }
      .row .spacer { flex: 1; }
      .file { font-size: 12px; color: var(--muted); max-width: 150px; }
      .btn { all: unset; box-sizing: border-box; cursor: pointer; font-size: 13px; font-weight: 600; padding: 7px 12px; border-radius: 7px; white-space: nowrap; }
      .btn.primary { background: var(--btn-bg); color: var(--btn-fg); }
      .btn.ghost { color: var(--muted); }
      .btn.ghost:hover { background: var(--subtle); }
      .btn.link { color: var(--ink); border: 1px solid var(--line); }
      .btn.link:hover { background: var(--subtle); }
      .badge { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600;
        color: var(--muted); text-decoration: none; padding: 6px 4px; }
      .badge.done { color: var(--ink); }
      .thumb { max-width: 100%; border-radius: 6px; margin-top: 6px; }
      /* ticket picker */
      .picker-search { width: 100%; border: 1px solid var(--line); border-radius: 8px; padding: 7px 9px;
        font-size: 13px; font-family: inherit; color: var(--ink); background: var(--subtle); }
      .picker-search:focus { outline: none; border-color: var(--accent); }
      .picker-list { max-height: 220px; overflow: auto; margin-top: 8px; }
      .picker-item { display: flex; gap: 8px; align-items: baseline; padding: 8px; border-radius: 7px; cursor: pointer; }
      .picker-item:hover { background: var(--subtle); }
      .picker-item .pid { font-family: ui-monospace, monospace; font-size: 11px; color: var(--muted); flex-shrink: 0; }
      .picker-item .pt { font-size: 13px; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .picker-empty { font-size: 12px; color: var(--muted); padding: 10px 4px; }
      .search-row { position: relative; }
      .search-row .picker-search { padding-right: 28px; }
      .search-spin { position: absolute; right: 9px; top: 50%; margin-top: -6px; width: 12px; height: 12px;
        border: 2px solid var(--line); border-top-color: var(--accent); border-radius: 50%;
        animation: dqa-spin .7s linear infinite; }
      @keyframes dqa-spin { to { transform: rotate(360deg); } }
      .picker-more { font-size: 11px; color: var(--muted); padding: 8px; text-align: center; }
      .opt { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); cursor: pointer; user-select: none; }
      .opt input { margin: 0; cursor: pointer; }
      .hint { position: fixed; top: 14px; left: 50%; transform: translateX(-50%); pointer-events: none;
        background: #fff; color: #111827; font-size: 12px; font-weight: 500; padding: 6px 14px; border-radius: 20px;
        border: 1px solid var(--line); box-shadow: 0 4px 14px rgba(0,0,0,.18); }
      /* sign-in card */
      .signin { position: fixed; bottom: 18px; right: 18px; pointer-events: auto; width: 260px;
        background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 16px;
        box-shadow: 0 6px 24px rgba(0,0,0,.12); }
      .signin h4 { margin: 0 0 4px; font-size: 14px; color: var(--ink); }
      .signin p { margin: 0 0 12px; font-size: 12px; color: var(--muted); line-height: 1.4; }
      .signin .btn { display: block; width: 100%; text-align: center; margin-top: 8px; }
      .signin .err { color: var(--danger); font-size: 12px; margin-top: 8px; }
      /* component inspector */
      .inspect { margin-top: 10px; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
      .i-tabs { display: flex; border-bottom: 1px solid var(--line); background: var(--subtle); }
      .i-tab { all: unset; cursor: pointer; flex: 1; text-align: center; font-size: 11px; font-weight: 600;
        padding: 6px 0; color: var(--muted); }
      .i-tab.active { color: var(--ink); background: var(--surface); }
      .i-body { max-height: 150px; overflow: auto; padding: 8px; }
      .i-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
      .i-row label { font-family: ui-monospace, monospace; font-size: 11px; color: var(--muted); width: 112px; flex-shrink: 0; }
      .i-row input { flex: 1; min-width: 0; border: 1px solid var(--line); border-radius: 5px; padding: 3px 6px;
        font-size: 11px; font-family: ui-monospace, monospace; color: var(--ink); background: var(--subtle); }
      .i-row input:focus { outline: none; border-color: var(--accent); }
      .i-row input.edited, .i-row select.edited { border-color: var(--accent); color: var(--accent); }
      .i-row input.i-color { flex: 0 0 26px; width: 26px; height: 22px; padding: 0; border-radius: 5px; cursor: pointer; background: none; }
      .i-row input.i-num { flex: 1; }
      .i-row select.i-unit { flex: 0 0 52px; border: 1px solid var(--line); border-radius: 5px; padding: 3px 4px;
        font-size: 11px; font-family: ui-monospace, monospace; color: var(--ink); background: var(--subtle); }
      /* highlight-all outlines */
      .outline-all { position: absolute; pointer-events: auto; border: 1px solid rgba(0,128,188,.55);
        background: rgba(0,128,188,.05); border-radius: 2px; cursor: pointer; }
      .outline-all:hover { border-color: var(--accent); background: rgba(0,128,188,.14); }
      .outline-all .oa-tag { position: absolute; left: 0; top: -15px; font-size: 9px; font-weight: 600; color: #fff;
        background: var(--accent); padding: 0 4px; border-radius: 3px; white-space: nowrap; max-width: 180px;
        overflow: hidden; text-overflow: ellipsis; }
      .class-input { width: 100%; margin-top: 6px; border: 1px solid var(--line); border-radius: 5px; padding: 4px 6px;
        font-size: 11px; font-family: ui-monospace, monospace; color: var(--ink); background: var(--subtle); }
      .class-input:focus { outline: none; border-color: var(--accent); }
      .chip { display: inline-block; font-family: ui-monospace, monospace; font-size: 10.5px; background: var(--subtle);
        border: 1px solid var(--line); color: var(--ink); border-radius: 4px; padding: 1px 5px; margin: 0 4px 4px 0; }
      .i-kv { font-family: ui-monospace, monospace; font-size: 11px; line-height: 1.6; word-break: break-all; }
      .i-kv b { color: var(--accent); font-weight: 600; }
      .i-empty { font-size: 11px; color: var(--muted); }
      .i-note { font-size: 10.5px; color: var(--muted); padding: 6px 8px; border-top: 1px solid var(--line); }
      .i-summary { margin-top: 8px; padding: 8px; border: 1px solid var(--line); border-radius: 8px; }
      .i-k { font-size: 11px; font-weight: 600; color: var(--ink); margin-bottom: 4px; }
      .i-edit { font-family: ui-monospace, monospace; font-size: 11px; line-height: 1.7; }
      .i-edit s { color: var(--muted); }
      .i-edit b { color: var(--accent); }
      .theme-btn { all: unset; cursor: pointer; font-size: 12px; padding: 2px 6px; border-radius: 5px; color: var(--muted); }
      .theme-btn:hover { background: var(--subtle); color: var(--ink); }
      .i-details { margin-top: 8px; border: 1px solid var(--line); border-radius: 8px; }
      .i-details summary { cursor: pointer; padding: 7px 8px; font-size: 11px; font-weight: 600;
        color: var(--ink); user-select: none; list-style: none; }
      .i-details summary::before { content: "▸ "; }
      .i-details[open] summary::before { content: "▾ "; }
      .i-details .i-inner { padding: 0 8px 8px; max-height: 140px; overflow: auto; }
      .shot-label { font-size: 11px; font-weight: 600; color: var(--ink); margin-top: 8px; }
      .prio { border: 1px solid var(--line); border-radius: 5px; background: var(--subtle); color: var(--ink);
        font-size: 11px; padding: 3px 4px; font-family: inherit; }
      .action-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 8px; }
      /* ---- redesigned comment card (thread + Linear panel) ---- */
      .popover.card2 { width: 380px; border-radius: 14px; font-size: 13px; }
      .card2 .body { padding: 0; }
      .card-header { display: flex; align-items: center; gap: 8px; padding: 12px 14px;
        border-bottom: 1px solid var(--line); flex-shrink: 0; }
      .card-header .ttl { flex: 1; font-size: 13px; font-weight: 600; color: var(--ink); white-space: nowrap; }
      .card-header .icon-x { all: unset; display: flex; align-items: center; justify-content: center;
        width: 26px; height: 26px; border-radius: 7px; color: var(--muted); cursor: pointer; flex-shrink: 0; }
      .card-header .icon-x:hover { background: var(--subtle); color: var(--ink); }
      .card-header .icon-x svg { width: 14px; height: 14px; }
      .path-row { padding: 8px 14px; border-bottom: 1px solid var(--line); background: var(--subtle); flex-shrink: 0; }
      .path-row details { font-size: 12px; }
      .path-row summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 6px;
        color: var(--muted); white-space: nowrap; overflow: hidden; user-select: none; }
      .path-row summary::-webkit-details-marker { display: none; }
      .path-row summary .trunc { overflow: hidden; text-overflow: ellipsis; }
      .path-row .cur { font-weight: 600; color: var(--ink); }
      .path-row summary .hint2 { flex-shrink: 0; margin-left: auto; font-size: 11px; color: var(--muted); opacity: .8; }
      .path-row details[open] summary .trunc, .path-row details[open] summary .hint2 { display: none; }
      /* full path lives inside <summary> so clicking it collapses again */
      .path-row summary .full-path { display: none; }
      .path-row details[open] summary .full-path { display: flex; }
      .full-path { flex: 1; display: flex; flex-wrap: wrap; align-items: center; gap: 3px 5px; padding: 6px 8px;
        white-space: normal; cursor: pointer; background: var(--surface); border: 1px solid var(--line);
        border-radius: 8px; font-size: 12px; line-height: 1.6; color: var(--muted); word-break: break-word; }
      .full-path .sep { opacity: .6; }
      .full-path .kind { opacity: .7; }
      .meta-strip { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding: 10px 14px;
        border-bottom: 1px solid var(--line); flex-shrink: 0; max-height: 88px; overflow-y: auto; }
      .tag2 { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 999px;
        font-size: 11px; font-weight: 500; line-height: 1.4; background: var(--subtle); color: var(--muted);
        border: 1px solid var(--line); max-width: 100%; }
      .tag2.el { color: var(--accent); border-color: var(--accent); background: transparent; }
      .tag2.el, .tag2.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      .tag2.edit b { color: var(--accent); font-weight: 600; }
      .tag2.edit s { opacity: .7; }
      .card2 .thread-scroll { padding: 12px 14px 4px; }
      .reply-area2 { padding: 8px 14px 12px; flex-shrink: 0; }
      .reply-box { display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: 10px;
        background: var(--surface); }
      .reply-box:focus-within { border-color: var(--accent); }
      .reply-box textarea { border: none; outline: none; resize: none; background: transparent; min-height: 40px;
        padding: 10px 12px 4px; font: inherit; font-size: 13px; color: var(--ink); }
      .reply-box textarea:focus { border: none; }
      .reply-actions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; padding: 6px 8px 8px; }
      .card-footer { display: flex; align-items: center; padding: 8px 10px; border-top: 1px solid var(--line);
        background: var(--subtle); flex-shrink: 0; }
      .card-footer .spacer { flex: 1; }
      .footer-action { all: unset; display: inline-flex; align-items: center; gap: 5px; cursor: pointer;
        font-size: 12px; font-weight: 500; color: var(--muted); padding: 6px 9px; border-radius: 7px; user-select: none; }
      .footer-action:hover { background: var(--surface); color: var(--ink); }
      .footer-action.danger { color: var(--danger); }
      .footer-action.danger:hover { color: var(--danger); background: rgba(200,46,31,.08); }
      .footer-action.success { color: var(--success); }
      .footer-action.success:hover { color: var(--success); background: rgba(0,124,35,.08); }
      .footer-action svg { width: 13px; height: 13px; flex-shrink: 0; }
      .synced-dot { font-size: 10px; color: var(--muted); margin-left: 4px; }
      /* linear panel */
      .linear-body { padding: 14px; display: flex; flex-direction: column; gap: 12px; flex: 1; min-height: 0; overflow-y: auto; }
      .radio-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
      .dev-note { display: flex; align-items: center; gap: 7px; font-size: 12px; color: var(--muted);
        padding: 8px 10px; background: var(--subtle); border: 1px dashed var(--line); border-radius: 8px; }
      .linear-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px;
        padding: 10px 14px; border-top: 1px solid var(--line); background: var(--subtle); flex-shrink: 0; }
      /* ---- redesigned compose (new comment) ---- */
      .new-body { padding: 12px 14px; display: flex; flex-direction: column; gap: 12px; }
      .comment-input { width: 100%; font: inherit; font-size: 13px; color: var(--ink); padding: 10px 12px;
        border: 1px solid var(--line); border-radius: 10px; background: var(--surface); resize: vertical; min-height: 64px; }
      .comment-input::placeholder { color: var(--muted); }
      .comment-input:focus { outline: none; border-color: var(--accent); }
      .inspector2 { border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
      .tab-bar { display: flex; background: var(--subtle); border-bottom: 1px solid var(--line); }
      .tab-bar .t { all: unset; flex: 1; text-align: center; padding: 8px 0; font-size: 12px; font-weight: 500;
        color: var(--muted); cursor: pointer; user-select: none; border-bottom: 2px solid transparent; }
      .tab-bar .t:hover { color: var(--ink); }
      .tab-bar .t.active { color: var(--ink); font-weight: 600; border-bottom-color: var(--accent); }
      .prop-list { max-height: 176px; overflow-y: auto; }
      .prop-row { display: grid; grid-template-columns: 104px 1fr 56px; gap: 8px; align-items: center; padding: 6px 12px; }
      .prop-row + .prop-row { border-top: 1px solid var(--line); }
      .prop-name { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px;
        color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .prop-value { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: var(--ink);
        padding: 5px 8px; border: 1px solid var(--line); border-radius: 7px; background: var(--surface);
        width: 100%; min-width: 0; }
      .prop-value:focus { outline: none; border-color: var(--accent); }
      .prop-value.wide { grid-column: 2 / 4; }
      .unit-select { font: inherit; font-size: 11.5px; color: var(--muted); padding: 5px 4px;
        border: 1px solid var(--line); border-radius: 7px; background: var(--surface); cursor: pointer; width: 100%; }
      .unit-select:focus { outline: none; border-color: var(--accent); }
      .prop-value.edited, .unit-select.edited { border-color: var(--accent); color: var(--accent); }
      .color-cell { display: flex; align-items: center; gap: 6px; grid-column: 2 / 4; }
      .swatch { flex-shrink: 0; width: 22px; height: 22px; border-radius: 6px; border: 1px solid var(--line);
        cursor: pointer; padding: 0; background: none; }
      .swatch::-webkit-color-swatch-wrapper { padding: 0; }
      .swatch::-webkit-color-swatch { border: none; border-radius: 5px; }
      .inspector-note { display: flex; gap: 7px; padding: 8px 12px; font-size: 11px; line-height: 1.5;
        color: var(--muted); background: var(--subtle); border-top: 1px solid var(--line); }
      .class-chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 12px; }
      .class-chip { display: inline-flex; align-items: center; gap: 5px;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; padding: 3px 8px;
        background: var(--subtle); border: 1px solid var(--line); border-radius: 999px; color: var(--muted); }
      .class-chip .x { cursor: pointer; color: var(--muted); font-size: 12px; line-height: 1; user-select: none; }
      .class-chip .x:hover { color: var(--danger); }
      .add-class { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px;
        border: 1px dashed var(--line); border-radius: 999px; padding: 3px 8px; width: 110px;
        background: transparent; color: var(--ink); }
      .add-class::placeholder { color: var(--muted); }
      .add-class:focus { outline: none; border-color: var(--accent); border-style: solid; }
      .rowkv { display: flex; gap: 10px; padding: 7px 12px;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; }
      .rowkv + .rowkv { border-top: 1px solid var(--line); }
      .rowkv .k { color: var(--muted); width: 40%; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; }
      .rowkv .v { color: var(--ink); word-break: break-word; min-width: 0; }
      .options-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 14px; }
      .file-input { font-size: 11px; color: var(--muted); max-width: 100%; }
      .action-footer { display: flex; align-items: center; justify-content: flex-end; gap: 8px;
        padding: 10px 14px; border-top: 1px solid var(--line); background: var(--subtle); flex-shrink: 0; }
      .i-empty2 { padding: 12px; font-size: 11px; color: var(--muted); }
      /* screenshots: standardized thumbnail slot — fixed height, contained
         (never stretched), click to magnify in the lightbox */
      .shot-box { position: relative; margin-top: 6px; height: 92px; padding: 6px; background: var(--subtle);
        border: 1px solid var(--line); border-radius: 8px; display: flex; align-items: center;
        justify-content: center; overflow: hidden; cursor: zoom-in; transition: border-color .15s; }
      .shot-box:hover { border-color: var(--accent); }
      /* corner badge: marks the slot as an image; flips to zoom-in on hover */
      .shot-ico { position: absolute; top: 5px; right: 5px; display: flex; align-items: center;
        justify-content: center; width: 20px; height: 20px; border-radius: 6px;
        background: var(--surface); border: 1px solid var(--line); color: var(--muted);
        pointer-events: none; }
      .shot-ico svg { width: 12px; height: 12px; }
      .shot-ico .z { display: none; }
      .shot-box:hover .shot-ico { color: var(--accent); border-color: var(--accent); }
      .shot-box:hover .shot-ico .i { display: none; }
      .shot-box:hover .shot-ico .z { display: block; }
      .shot-box img.thumb { max-width: 100%; max-height: 100%; width: auto; height: auto;
        object-fit: contain; border-radius: 4px; margin: 0; box-shadow: 0 1px 3px rgba(0,0,0,.12); display: block; }
      .lightbox { position: fixed; inset: 0; z-index: 2147483630; background: rgba(0,0,0,.72);
        display: flex; align-items: center; justify-content: center; cursor: zoom-out; padding: 24px; }
      .lightbox img { max-width: min(1400px, 94vw); max-height: 92vh; border-radius: 10px;
        box-shadow: 0 12px 48px rgba(0,0,0,.5); background: #fff; }
      .lightbox .lb-cap { position: fixed; bottom: 14px; left: 50%; transform: translateX(-50%);
        font-size: 12px; color: #fff; opacity: .8; user-select: none; }
    </style>
    <div class="layer" id="pins"></div>
    <div class="layer" id="outline-all"></div>
    <div class="layer" id="hl-layer"><div class="hl" id="hl"><span class="hl-label" id="hl-label"></span></div></div>
    <div class="layer" id="cursors"></div>
    <div id="ui"></div>
  `

  const pinsLayer = root.getElementById('pins')
  const outlineLayer = root.getElementById('outline-all')
  const cursorsLayer = root.getElementById('cursors')
  const hlBox = root.getElementById('hl')
  const hlLabel = root.getElementById('hl-label')
  const ui = root.getElementById('ui')
  ui.style.pointerEvents = 'none'
  const styleFix = document.createElement('style')
  styleFix.textContent =
    '.toolbar,.popover,.pin,.signin,.lightbox{pointer-events:auto!important;}'
  root.appendChild(styleFix)
  if (EMBED) {
    const embedHide = document.createElement('style')
    embedHide.textContent =
      '.signin,.toolbar{display:none!important;visibility:hidden!important;pointer-events:none!important;}'
    root.appendChild(embedHide)
  }

  // ---- theme (dark default, persisted) -----------------------------------
  let THEME = 'dark'
  try {
    THEME = localStorage.getItem('dqa_theme') === 'light' ? 'light' : 'dark'
  } catch {}
  function applyTheme() {
    host.classList.toggle('light', THEME === 'light')
  }
  function setTheme(t) {
    THEME = t === 'light' ? 'light' : 'dark'
    try {
      localStorage.setItem('dqa_theme', THEME)
    } catch {}
    applyTheme()
    notifyState()
  }
  applyTheme()

  let commentMode = false,
    comments = [],
    activeCommentId = null,
    activePopover = null,
    draft = null,
    hoverEl = null,
    pinnedEl = null,
    ws = null
  let showResolved = false
  try {
    showResolved = localStorage.getItem('dqa_show_resolved') === '1'
  } catch {}
  // Comment pins on the page (bubbles) — can be hidden to view the page clean.
  let showPins = true
  try {
    showPins = localStorage.getItem('dqa_show_pins') !== '0'
  } catch {}
  let authConf = { oauthConfigured: false, devAllowed: true }
  let signInError = null
  let ready = false
  let loading = true
  const listeners = new Set()

  function getOpenCount() {
    return comments.filter((c) => c.status !== 'resolved').length
  }

  function serializeComments() {
    return comments.map((c, i) => ({
      id: c.id,
      pinIndex: i + 1,
      body: c.body,
      author: c.author,
      authorId: c.authorId || null,
      authorAvatar: c.authorAvatar || null,
      status: c.status === 'resolved' ? 'resolved' : 'open',
      anchorLabel: (c.anchor && c.anchor.label) || '',
      replyCount: (c.replies || []).length,
      createdAt: c.createdAt || new Date().toISOString(),
      issueRef: c.issueRef || null,
      linear: c.linear || null,
      linearDeleted: !!c.linearDeleted,
    }))
  }

  function getPresenceUsers() {
    if (!USER) return []
    const users = [
      {
        id: USER.id || 'self',
        name: USER.name,
        color: USER.color || '#111827',
        avatarUrl: USER.avatarUrl || null,
      },
    ]
    cursorEls.forEach((el, id) => {
      const tag = el.querySelector('.tag')
      if (!tag) return
      users.push({
        id: id || tag.textContent || 'peer',
        name: tag.textContent || 'Peer',
        color: tag.style.background || '#777',
        avatarUrl: el.dataset.avatarUrl || null,
      })
    })
    return users
  }

  function getState() {
    return {
      ready,
      loading,
      authenticated: !!(TOKEN && USER),
      user: USER,
      commentMode,
      openCount: getOpenCount(),
      presence: getPresenceUsers(),
      authConfig: authConf,
      signInError,
      comments: serializeComments(),
      activeCommentId,
      pageIssueRef: ISSUE_REF,
      theme: THEME,
      showResolved,
      showPins,
      outlineAll,
      pageUrl: PAGE_URL,
    }
  }

  function notifyState() {
    const state = getState()
    listeners.forEach((cb) => {
      try {
        cb(state)
      } catch {}
    })
  }

  async function fetchAuthConfig() {
    try {
      authConf = await (await fetch(API + '/auth/config')).json()
    } catch {}
    // Delegated auth: an ephemeral deployment (e.g. per-PR env) points at a
    // long-lived instance that owns the registered Linear redirect URI. Sign-in
    // popups open there and its postMessages are trusted; the session it mints
    // is valid on this instance because both share SESSION_SECRET.
    if (authConf.authOrigin) {
      try {
        AUTH = new URL(authConf.authOrigin).origin
      } catch {}
    }
    notifyState()
    return authConf
  }

  async function devLogin(name) {
    // Empty name is fine — the server auto-assigns a unique "Dev N" per
    // session, so each browser shows up as a separate user.
    const devName = (name && String(name).trim()) || ''
    signInError = null
    try {
      const r = await fetch(
        API + '/auth/dev?name=' + encodeURIComponent(devName),
      )
      const d = await r.json()
      if (d.token) {
        setToken(d.token)
        USER = null
        await init()
      } else showSignIn('dev login failed')
    } catch {
      showSignIn('dev login failed')
    }
  }

  // ---- auth-aware fetch -------------------------------------------------
  async function api(path, opts = {}) {
    const headers = Object.assign({}, opts.headers || {})
    if (TOKEN) headers.Authorization = 'Bearer ' + TOKEN
    const res = await fetch(API + path, Object.assign({}, opts, { headers }))
    if (res.status === 401) {
      signOut()
      throw new Error('unauthorized')
    }
    return res
  }

  // ======================================================================
  //  AUTH
  // ======================================================================
  function setToken(t) {
    TOKEN = t
    try {
      t
        ? localStorage.setItem('dqa_token', t)
        : localStorage.removeItem('dqa_token')
    } catch {}
  }

  async function init() {
    loading = true
    notifyState()
    if (TOKEN) {
      try {
        const r = await fetch(API + '/auth/me', {
          headers: { Authorization: 'Bearer ' + TOKEN },
        })
        if (r.ok) {
          USER = await r.json()
          loading = false
          ready = true
          notifyState()
          return start()
        }
      } catch {}
      setToken(null)
    }
    loading = false
    ready = true
    notifyState()
    showSignIn()
  }

  async function showSignIn(err) {
    teardown()
    signInError = err || null
    await fetchAuthConfig()
    if (EMBED) {
      ui.style.pointerEvents = 'none'
      notifyState()
      return
    }
    const card = document.createElement('div')
    card.className = 'signin'
    card.innerHTML = `
      <h4>Design QA</h4>
      <p>Sign in to leave comments on this page.</p>
      ${authConf.oauthConfigured ? '<button class="btn primary" data-act="linear">Sign in with Linear</button>' : ''}
      ${authConf.devAllowed ? `<button class="btn ${authConf.oauthConfigured ? 'ghost' : 'primary'}" data-act="dev">Continue in dev mode</button>` : ''}
      ${signInError ? `<div class="err">${esc(signInError)}</div>` : ''}`
    ui.style.pointerEvents = 'auto'
    ui.appendChild(card)
    const lin = card.querySelector('[data-act="linear"]')
    if (lin) lin.onclick = startLinearLogin
    const dev = card.querySelector('[data-act="dev"]')
    if (dev)
      dev.onclick = async () => {
        const name = prompt('Dev mode — your name:', '') || 'Dev'
        await devLogin(name)
      }
    notifyState()
  }

  function startLinearLogin() {
    openAuthPopup('/auth/linear')
  }

  function switchLinearAccount() {
    signInError = null
    setToken(null)
    USER = null
    notifyState()
    openAuthPopup('/auth/account-switch')
  }

  function openAuthPopup(authPath) {
    const returnUrl = location.href
    const url = `${AUTH}${authPath}?origin=${encodeURIComponent(location.origin)}&returnUrl=${encodeURIComponent(returnUrl)}`
    const priorToken = TOKEN
    let popup = null
    let pollTimer = null
    let done = false

    function cleanup() {
      window.removeEventListener('message', onMsg)
      window.removeEventListener('storage', onStorage)
      if (pollTimer) clearInterval(pollTimer)
    }

    function finishLogin(token, err) {
      if (done) return
      done = true
      cleanup()
      if (token) {
        setToken(token)
        USER = null
        init()
      } else if (err) showSignIn(err)
      try {
        popup && popup.close()
      } catch {}
    }

    function onMsg(e) {
      if (e.origin !== AUTH) return // only trust messages from our (possibly delegated) auth service
      if (e.data && e.data.token) finishLogin(e.data.token)
      else if (e.data && e.data.error) finishLogin(null, e.data.error)
    }

    function onStorage(e) {
      if (e.key !== 'dqa_token' || !e.newValue || e.newValue === priorToken)
        return
      finishLogin(e.newValue)
    }

    window.addEventListener('message', onMsg)
    window.addEventListener('storage', onStorage)

    popup = window.open(url, 'dqa_login', 'width=520,height=680')
    if (!popup) {
      // Popup blocked — continue in this tab; callback redirects back via returnUrl.
      location.href = url
      return
    }

    // Fallback when OAuth breaks window.opener (common after cross-site redirects).
    pollTimer = setInterval(() => {
      if (!popup.closed) return
      cleanup()
      pollTimer = null
      try {
        const t = localStorage.getItem('dqa_token')
        if (t && t !== priorToken) finishLogin(t)
      } catch {}
    }, 400)
  }

  async function signOut() {
    try {
      await fetch(API + '/auth/logout', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + TOKEN },
      })
    } catch {}
    setToken(null)
    USER = null
    if (ws) {
      try {
        ws.close()
      } catch {}
      ws = null
    }
    cursorEls.forEach((el) => {
      el.remove()
    })
    cursorEls.clear()
    comments = []
    renderPins()
    showSignIn()
  }

  function teardown() {
    closePopover()
    root.querySelectorAll('.toolbar, .signin').forEach((node) => {
      node.remove()
    })
  }

  // ======================================================================
  //  start (post-auth)
  // ======================================================================
  function start() {
    teardown()
    ui.style.pointerEvents = 'none'
    signInError = null
    if (!EMBED) renderToolbar()
    else notifyState()
    loadComments()
    connect()
  }

  // ---- resilient element anchoring --------------------------------------
  const STABLE_ATTRS = [
    'data-testid',
    'data-test',
    'data-qa',
    'data-component',
    'data-cy',
    'id',
  ]
  function stableAttrSelector(node) {
    if (!node || node.nodeType !== 1 || !node.getAttribute) return null
    for (const attr of STABLE_ATTRS) {
      const v = node.getAttribute(attr)
      if (v) return `[${attr}="${cssEscape(v)}"]`
    }
    return null
  }
  function buildSelector(el) {
    // A stable attribute on the element ITSELF identifies it directly.
    const own = stableAttrSelector(el)
    if (own)
      return {
        selector: own,
        label: el.getAttribute('data-component') || el.tagName.toLowerCase(),
      }
    // Otherwise build a direct-child nth-of-type path from the element up to
    // the nearest stable-attr ancestor (used as a SCOPE PREFIX) or <body>.
    // The old code returned the stable ancestor itself — in apps without
    // data-testids everywhere (explorer/portal) every comment anchored to
    // the first ancestor with an id, i.e. div#app.
    const parts = []
    let node = el
    let prefix = 'body > '
    // True when the walk reached a stable-attr scope or <body> — i.e. the
    // prefix genuinely anchors the path. Checking parts.length instead would
    // wrongly strip a valid prefix when anchoring happens on the 20th segment.
    let anchored = false
    while (
      node &&
      node.nodeType === 1 &&
      node !== document.body &&
      parts.length < 20
    ) {
      let part = node.tagName.toLowerCase()
      const parent = node.parentElement
      if (parent) {
        const sameTag = [...parent.children].filter(
          (c) => c.tagName === node.tagName,
        )
        if (sameTag.length > 1)
          part += `:nth-of-type(${sameTag.indexOf(node) + 1})`
      }
      parts.unshift(part)
      const scope = stableAttrSelector(parent)
      if (scope && parent !== document.body) {
        prefix = `${scope} > `
        anchored = true
        break
      }
      if (!parent || parent === document.body) {
        anchored = true
        break
      }
      node = parent
    }
    // Depth cap hit without reaching body/scope: drop the anchored prefix so
    // the (rare) truncated path can still match as a descendant selector.
    if (!anchored) prefix = ''
    return {
      selector: prefix + parts.join(' > '),
      label: el.tagName.toLowerCase(),
    }
  }
  function cssEscape(s) {
    return String(s).replace(/"/g, '\\"')
  }
  function captureAnchor(el, clientX, clientY) {
    const rect = el.getBoundingClientRect()
    const { selector, label } = buildSelector(el)
    return {
      selector,
      label,
      offsetX: rect.width ? (clientX - rect.left) / rect.width : 0.5,
      offsetY: rect.height ? (clientY - rect.top) / rect.height : 0.5,
      pageXPct:
        (clientX + window.scrollX) / document.documentElement.scrollWidth,
      pageYPct:
        (clientY + window.scrollY) / document.documentElement.scrollHeight,
    }
  }
  function resolveAnchor(anchor) {
    let el = null
    try {
      el = document.querySelector(anchor.selector)
    } catch {}
    if (el) {
      const r = el.getBoundingClientRect()
      return {
        x: r.left + anchor.offsetX * r.width,
        y: r.top + anchor.offsetY * r.height,
        el,
        found: true,
      }
    }
    return {
      x:
        anchor.pageXPct * document.documentElement.scrollWidth - window.scrollX,
      y:
        anchor.pageYPct * document.documentElement.scrollHeight -
        window.scrollY,
      el: null,
      found: false,
    }
  }

  // ---- component inspection (classes, computed styles, React props) ------
  const INSPECT_PROPS = [
    'font-size',
    'font-weight',
    'line-height',
    'letter-spacing',
    'color',
    'background-color',
    'padding',
    'margin',
    'border-radius',
    'display',
    'align-items',
    'justify-content',
    'gap',
    'width',
    'height',
  ]
  function reactPropsOf(el) {
    try {
      let node = el
      for (
        let depth = 0;
        node && depth < 3;
        depth++, node = node.parentElement
      ) {
        const key = Object.keys(node).find((k) => k.startsWith('__reactProps$'))
        if (!key) continue
        const raw = node[key]
        const out = {}
        for (const [k, v] of Object.entries(raw)) {
          if (k === 'children') continue
          if (typeof v === 'function') out[k] = 'ƒ'
          else if (v == null || typeof v !== 'object') out[k] = String(v)
          else {
            try {
              out[k] = JSON.stringify(v).slice(0, 120)
            } catch {
              out[k] = '{…}'
            }
          }
        }
        if (Object.keys(out).length) return out
      }
    } catch {}
    return null
  }
  // Nearest React component names from the fiber — far more reliable than a
  // tag-based description ("RegisterCard › Button" instead of "button").
  function componentPathOf(el) {
    try {
      const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'))
      if (!key) return null
      let fiber = el[key]
      const names = []
      while (fiber && names.length < 4) {
        const t = fiber.type
        let name = null
        if (typeof t === 'function') name = t.displayName || t.name
        else if (t && typeof t === 'object')
          name =
            t.displayName ||
            (t.render && (t.render.displayName || t.render.name)) ||
            null
        if (
          name &&
          !/^(Fragment|Suspense|Provider|Consumer|Anonymous)$/.test(name) &&
          names[names.length - 1] !== name
        ) {
          names.push(name)
        }
        fiber = fiber.return
      }
      return names.length ? names.reverse().join(' › ') : null
    } catch {
      return null
    }
  }
  function captureInspect(el) {
    const cs = getComputedStyle(el)
    const styles = {}
    INSPECT_PROPS.forEach((p) => {
      styles[p] = cs.getPropertyValue(p)
    })
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      classes: [...el.classList],
      styles,
      props: reactPropsOf(el),
      componentPath: componentPathOf(el),
      text: (el.textContent || '').trim().slice(0, 80),
      viewport: `${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio || 1}x`,
    }
  }

  // ---- element screenshots (html-to-image, lazy) ---------------------------
  // html-to-image renders through the browser itself (SVG foreignObject), so
  // modern CSS — Tailwind v4 oklch() colors etc. — works. html2canvas parses
  // CSS in JS and throws `unsupported color function "oklch"` on these apps.
  // Vite splits this dynamic import into its own chunk, so the ~17 kB of
  // capture code is only fetched the first time someone actually attaches a
  // screenshot. The module registry caches it — repeat calls don't re-fetch.
  const loadHtmlToImage = () => import('html-to-image')
  // The element's OWN background is usually transparent — the page color
  // comes from an ancestor. Without it, captures of light-on-dark UIs render
  // light text on transparency (unreadable on the popover). Walk up to the
  // first ancestor that actually paints a background color.
  function effectiveBackground(el) {
    let node = el
    while (node && node.nodeType === 1) {
      const bg = getComputedStyle(node).backgroundColor
      if (bg && bg !== 'transparent') {
        // skip fully transparent rgba(0,0,0,0) / colors with alpha 0
        const m = bg.match(/rgba?\(([^)]+)\)/)
        const alpha = m ? Number((m[1].split(',')[3] ?? '1').trim()) : 1
        if (alpha > 0) return bg
      }
      node = node.parentElement
    }
    return '#ffffff'
  }
  async function captureElementShot(el) {
    try {
      const h2i = await loadHtmlToImage()
      const blob = await h2i.toBlob(el, {
        pixelRatio: Math.min(2, window.devicePixelRatio || 1),
        backgroundColor: effectiveBackground(el),
      })
      if (!blob) return null
      const fd = new FormData()
      fd.append('image', blob, 'element.png')
      const r = await (
        await api('/api/upload', { method: 'POST', body: fd })
      ).json()
      return r.imageUrl || null
    } catch (e) {
      console.warn('[DQA] element screenshot failed:', e && e.message)
      return null
    }
  }

  // ---- element highlight ------------------------------------------------
  let treeHoverEl = null // element hovered in the DevDrawer element tree
  function renderHighlight() {
    const el = pinnedEl || treeHoverEl || (commentMode ? hoverEl : null)
    if (!el || !el.getBoundingClientRect) {
      hlBox.style.display = 'none'
      return
    }
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) {
      hlBox.style.display = 'none'
      return
    }
    hlBox.style.display = 'block'
    hlBox.style.left = r.left + 'px'
    hlBox.style.top = r.top + 'px'
    hlBox.style.width = r.width + 'px'
    hlBox.style.height = r.height + 'px'
    const path = componentPathOf(el)
    hlLabel.textContent = path
      ? path.split(' › ').pop()
      : buildSelector(el).label
  }

  // ---- pins -------------------------------------------------------------
  function setShowPins(on) {
    showPins = !!on
    try {
      localStorage.setItem('dqa_show_pins', showPins ? '1' : '0')
    } catch {}
    renderPins()
    renderToolbar() // refresh the eye icon (no-op in embed mode)
    notifyState()
  }
  function renderPins() {
    pinsLayer.innerHTML = ''
    if (!showPins) return
    comments.forEach((c) => {
      if (!c.anchor) return
      if (c.status === 'resolved' && !showResolved) return
      const pos = resolveAnchor(c.anchor)
      const pin = document.createElement('div')
      pin.className = 'pin' + (c.status === 'resolved' ? ' resolved' : '')
      pin.style.left = pos.x + 'px'
      pin.style.top = pos.y + 'px'
      // Unique participants: comment author first, then reply authors (deduped
      // by name). Show up to 3 avatars; "+N" if more people are on the thread.
      const participants = []
      const seen = new Set()
      for (const p of [
        { name: c.author, avatarUrl: c.authorAvatar },
        ...(c.replies || []).map((r) => ({
          name: r.author,
          avatarUrl: r.authorAvatar,
        })),
      ]) {
        const key = p.name || '?'
        if (seen.has(key)) continue
        seen.add(key)
        participants.push(p)
      }
      participants.slice(0, 3).forEach((p) => {
        const av = document.createElement('span')
        av.className = 'pin-av'
        fillAvatar(av, {
          name: p.name,
          avatarUrl: p.avatarUrl,
          color: avatarColor(p.name),
          letterClass: 'pin-letter',
        })
        pin.appendChild(av)
      })
      if (participants.length > 3) {
        const more = document.createElement('span')
        more.className = 'pin-more'
        more.textContent = '+' + (participants.length - 3)
        pin.appendChild(more)
      }
      const snippet = String(c.body || '').slice(0, 80)
      const names = participants
        .map((p) => p.name)
        .filter(Boolean)
        .join(', ')
      pin.title = names ? `${names}${snippet ? ' — ' + snippet : ''}` : snippet
      pin.addEventListener('click', (e) => {
        e.stopPropagation()
        activeCommentId = c.id
        notifyState()
        openThread(c, resolveAnchor(c.anchor))
      })
      pinsLayer.appendChild(pin)
    })
  }
  function reposition() {
    if (comments.length) renderPins()
    if (outlineAll) renderOutlineAll()
    renderHighlight()
    repositionPopover()
  }
  // Keep the open comment card glued to its anchored element on scroll —
  // same behavior as the pins. `_follow.dx/dy` preserve the card's offset
  // from the anchor (including any manual drag).
  function repositionPopover() {
    const pop = activePopover
    const f = pop && pop._follow
    if (!f || !f.anchor) return
    const p = resolveAnchor(f.anchor)
    if (!p) return
    // No viewport clamping here: like the pins, the card scrolls out of view
    // with its element instead of getting stuck at the screen edge.
    pop.style.left = p.x + f.dx + 'px'
    pop.style.top = p.y + f.dy + 'px'
  }
  window.addEventListener('scroll', reposition, true)
  window.addEventListener('resize', reposition)

  // ---- highlight-all: outline every commentable element at once ----------
  // Helps find elements that are hard to hover (transparent, behind others,
  // zero-size until interacted with). Click any outline to comment on it.
  let outlineAll = false
  function commentableElements() {
    const seen = new Set()
    const out = []
    // Prefer elements with a stable anchor or a React component identity.
    for (const el of document.body.querySelectorAll('*')) {
      if (out.length >= 500) break
      if (el.closest('[data-dqa-ignore]') || el.getRootNode() === root) continue
      const hasStable = STABLE_ATTRS.some((a) => el.hasAttribute(a))
      const comp = hasStable ? null : componentPathOf(el)
      if (!hasStable && !comp) continue
      const r = el.getBoundingClientRect()
      if (r.width < 4 && r.height < 4) continue // skip truly zero-size
      if (seen.has(el)) continue
      seen.add(el)
      out.push({
        el,
        rect: r,
        label: comp ? comp.split(' › ').pop() : buildSelector(el).label,
      })
    }
    return out
  }
  function renderOutlineAll() {
    outlineLayer.innerHTML = ''
    if (!outlineAll) return
    for (const { el, label } of commentableElements()) {
      const r = el.getBoundingClientRect()
      if (r.bottom < 0 || r.top > window.innerHeight) continue // only what's on screen
      const box = document.createElement('div')
      box.className = 'outline-all'
      box.style.left = r.left + 'px'
      box.style.top = r.top + 'px'
      box.style.width = r.width + 'px'
      box.style.height = r.height + 'px'
      const tag = document.createElement('span')
      tag.className = 'oa-tag'
      tag.textContent = label
      box.appendChild(tag)
      box.addEventListener('click', (e) => {
        e.stopPropagation()
        e.preventDefault()
        setOutlineAll(false)
        const cx = r.left + r.width / 2,
          cy = r.top + Math.min(20, r.height / 2)
        openCompose(captureAnchor(el, cx, cy), cx, cy)
      })
      outlineLayer.appendChild(box)
    }
  }
  function setOutlineAll(on) {
    outlineAll = !!on
    outlineLayer.style.pointerEvents = outlineAll ? 'auto' : 'none'
    renderOutlineAll()
    notifyState()
  }

  // ---- element tree (DevTools-style hierarchy for the DevDrawer) ---------
  // Builds a nested tree of "meaningful" elements (stable attrs, semantic tags,
  // or a React component identity), collapsing anonymous wrapper divs. Each
  // node gets a uid the drawer uses to hover-highlight or start a comment —
  // so invisible / hard-to-hover elements are reachable from the list.
  const SEMANTIC =
    /^(main|header|nav|footer|section|article|aside|form|button|a|h1|h2|h3|h4|h5|h6|ul|ol|li|table|img|svg|input|select|textarea|label|dialog|summary|details)$/i
  const uidMap = new Map() // uid -> element
  let uidSeq = 0
  function isMeaningful(el) {
    if (el.getRootNode() === root) return false
    if (el.closest && el.closest('[data-dqa-ignore]')) return false
    if (STABLE_ATTRS.some((a) => el.hasAttribute(a))) return true
    if (SEMANTIC.test(el.tagName)) return true
    return !!componentPathOf(el)
  }
  function buildTree(el, depth) {
    const nodes = []
    for (const child of el.children) {
      if (uidMap.size >= 1000) break
      if (
        child.getRootNode() === root ||
        (child.closest && child.closest('[data-dqa-ignore]'))
      )
        continue
      if (isMeaningful(child)) {
        const uid = ++uidSeq
        uidMap.set(uid, child)
        const comp = componentPathOf(child)
        const r = child.getBoundingClientRect()
        const hidden =
          (r.width < 2 && r.height < 2) ||
          getComputedStyle(child).display === 'none' ||
          getComputedStyle(child).visibility === 'hidden'
        nodes.push({
          uid,
          tag: child.tagName.toLowerCase(),
          label: comp ? comp.split(' › ').pop() : buildSelector(child).label,
          component: comp || null,
          hidden,
          children: depth < 14 ? buildTree(child, depth + 1) : [],
        })
      } else {
        // Anonymous wrapper — surface its meaningful descendants inline.
        nodes.push(...buildTree(child, depth))
      }
    }
    return nodes
  }
  function getElementTree() {
    uidMap.clear()
    uidSeq = 0
    return buildTree(document.body, 0)
  }
  function hoverElement(uid) {
    const el = uidMap.get(uid)
    if (!el) return
    treeHoverEl = el
    renderHighlight()
  }
  function clearHoverElement() {
    treeHoverEl = null
    renderHighlight()
  }
  function commentOnElement(uid) {
    const el = uidMap.get(uid)
    if (!el) return
    treeHoverEl = null
    try {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    } catch {}
    const r = el.getBoundingClientRect()
    const cx = r.left + r.width / 2,
      cy = r.top + Math.min(20, r.height / 2)
    openCompose(captureAnchor(el, cx, cy), cx, cy)
  }

  // ---- compose ----------------------------------------------------------
  function openCompose(anchor, x, y) {
    closePopover()
    const el = resolveAnchor(anchor).el
    pinnedEl = el
    renderHighlight()
    const inspect = el ? captureInspect(el) : null
    const styleEdits = new Map() // prop -> { from, to } (live-preview edits)
    const origInline = el ? el.getAttribute('style') : null
    const origClass = el ? el.getAttribute('class') : null
    draft = {
      anchor,
      x,
      y,
      // Live edits are previews only — always restore the element on close.
      revert: () => {
        if (!el) return
        if (origInline == null) el.removeAttribute('style')
        else el.setAttribute('style', origInline)
        if (origClass == null) el.removeAttribute('class')
        else el.setAttribute('class', origClass)
      },
    }
    const pop = document.createElement('div')
    pop.className = 'popover card2'
    placePopover(pop, x, y)
    // Follow the anchored element on scroll (offset from anchor preserved).
    pop._follow = {
      anchor,
      dx: parseFloat(pop.style.left) - x,
      dy: parseFloat(pop.style.top) - y,
    }
    pop.innerHTML = `
      <div class="card-header">
        <span class="ttl">New comment</span>
        <button class="icon-x" data-act="cancel" title="Close" aria-label="Close">${ICONS.x}</button>
      </div>
      ${pathRowHtml({ inspect, anchor })}
      ${metaStripHtml({ inspect })}
      <div class="body">
        <div class="new-body">
          <textarea class="comment-input" rows="3" placeholder="What's off? (size, spacing, copy, behaviour…)" aria-label="Comment"></textarea>
          ${
            inspect
              ? `
          <div class="inspector2">
            <div class="tab-bar" role="tablist">
              <button class="t active" data-itab="styles">Styles</button>
              <button class="t" data-itab="classes">Classes</button>
              <button class="t" data-itab="props">Props</button>
            </div>
            <div data-ibody></div>
            <div class="inspector-note"><span data-inote>Style edits apply to the page live (like devtools) and attach as suggestions.</span></div>
          </div>`
              : ''
          }
          <input class="file file-input" type="file" accept="image/*" aria-label="Attach image" />
          <div class="options-row">
            <label class="opt"><input type="checkbox" data-act="shot" checked /> Element screenshot</label>
            <label class="opt"><input type="checkbox" data-act="tolinear" /> Send to Linear</label>
          </div>
        </div>
      </div>
      <div class="action-footer">
        <button class="btn ghost" data-act="cancel">Cancel</button>
        <button class="btn primary" data-act="save">Comment</button>
      </div>`
    ui.appendChild(pop)
    activePopover = pop
    makeDraggable(pop)
    if (inspect && el) wireInspector(pop, el, inspect, styleEdits)
    const ta = pop.querySelector('textarea')
    ta.focus()
    pop.querySelectorAll('[data-act="cancel"]').forEach((b) => {
      b.onclick = closePopover
    })
    const saveBtn = pop.querySelector('[data-act="save"]')
    saveBtn.onclick = async () => {
      const body = ta.value.trim()
      if (!body) return ta.focus()
      saveBtn.textContent = 'Saving…'
      saveBtn.disabled = true
      const file = pop.querySelector('.file').files[0]
      const wantShot = pop.querySelector('[data-act="shot"]')?.checked
      const toLinear = pop.querySelector('[data-act="tolinear"]')?.checked
      const edits = [...styleEdits.entries()]
        .filter(([, v]) => v.from !== v.to)
        .map(([prop, v]) => ({ prop, from: v.from, to: v.to }))
      let imageUrl = null,
        afterImageUrl = null
      if (file) imageUrl = await uploadImage(file)
      if (wantShot && el) {
        // With live edits applied, capture the suggested ("after") state first,
        // then revert and capture the current ("before") state.
        if (edits.length) afterImageUrl = await captureElementShot(el)
        if (draft && draft.revert) {
          try {
            draft.revert()
          } catch {}
        }
        if (!imageUrl) imageUrl = await captureElementShot(el)
      }
      const created = await postComment({
        body,
        anchor,
        imageUrl,
        afterImageUrl,
        inspect,
        styleEdits: edits,
      })
      await loadComments()
      // If "Send to Linear" was ticked, keep the popover open and show the
      // ticket picker for the comment we just created.
      if (toLinear && created && created.id) openPicker(created)
      else closePopover()
    }
  }

  // --- style-edit input helpers -----------------------------------------
  const COLOR_PROPS = new Set(['color', 'background-color', 'border-color'])
  // Reject anything that could smuggle a CSS payload (url() trackers, imports,
  // extra declarations). Typed inputs already constrain most of this; this is
  // defense-in-depth and mirrors the server-side check.
  function isSafeCssValue(v) {
    return (
      typeof v === 'string' &&
      v.length <= 200 &&
      !/[<>{};]|url\(|expression|javascript:|@import|\\/i.test(v)
    )
  }
  // Resolve any CSS colour string to #rrggbb for the native colour input.
  function colorToHex(input) {
    try {
      const d = document.createElement('div')
      d.style.color = ''
      d.style.color = String(input)
      if (!d.style.color) return null // invalid colour
      d.style.position = 'absolute'
      d.style.opacity = '0'
      d.style.pointerEvents = 'none'
      document.body.appendChild(d)
      const cs = getComputedStyle(d).color
      document.body.removeChild(d)
      const m = cs.match(/\d+(\.\d+)?/g)
      if (!m || m.length < 3) return null
      return (
        '#' +
        m
          .slice(0, 3)
          .map((n) => Math.round(+n).toString(16).padStart(2, '0'))
          .join('')
      )
    } catch {
      return null
    }
  }
  // Single length like "60px" / "1.5" / "50%" → { num, unit }, else null.
  function parseSingleLength(v) {
    const m = String(v)
      .trim()
      .match(/^(-?\d*\.?\d+)(px|rem|em|%|vh|vw|)$/)
    return m ? { num: parseFloat(m[1]), unit: m[2] } : null
  }

  // Inspector tabs: editable computed styles (live preview), Tailwind class
  // chips (removable + addable), and React props read from the fiber.
  const INSPECTOR_NOTES = {
    styles:
      'Style edits apply to the page live (like devtools) and attach as suggestions.',
    classes:
      'Class changes apply live and attach to the comment as suggestions.',
    props: 'Read-only props of the selected component instance.',
  }
  function wireInspector(pop, el, inspect, styleEdits) {
    const body = pop.querySelector('[data-ibody]')
    const note = pop.querySelector('[data-inote]')
    const tabs = [...pop.querySelectorAll('.tab-bar .t')]
    function show(tabKey) {
      tabs.forEach((t) => {
        t.classList.toggle('active', t.dataset.itab === tabKey)
      })
      if (note) note.textContent = INSPECTOR_NOTES[tabKey]
      body.innerHTML = ''
      if (tabKey === 'styles') {
        const list = document.createElement('div')
        list.className = 'prop-list'
        Object.entries(inspect.styles).forEach(([prop, val]) => {
          const row = document.createElement('div')
          row.className = 'prop-row'
          const label = document.createElement('span')
          label.className = 'prop-name'
          label.textContent = prop
          label.title = prop
          row.appendChild(label)
          const cur = (styleEdits.get(prop) && styleEdits.get(prop).to) || val
          const applyEdit = (next) => {
            if (!isSafeCssValue(next)) return
            try {
              el.style.setProperty(prop, next)
            } catch {}
            styleEdits.set(prop, { from: inspect.styles[prop], to: next })
            renderHighlight()
          }
          if (COLOR_PROPS.has(prop)) {
            // Native colour swatch + a text field (for transparent/currentColor/etc).
            const cell = document.createElement('div')
            cell.className = 'color-cell'
            const color = document.createElement('input')
            color.type = 'color'
            color.className = 'swatch'
            color.value = colorToHex(cur) || '#000000'
            const text = document.createElement('input')
            text.className = 'prop-value'
            text.value = cur
            text.classList.toggle('edited', cur !== val)
            color.oninput = () => {
              text.value = color.value
              text.classList.add('edited')
              applyEdit(color.value)
            }
            text.oninput = () => {
              const h = colorToHex(text.value)
              if (h) color.value = h
              text.classList.toggle('edited', text.value !== val)
              applyEdit(text.value)
            }
            cell.append(color, text)
            row.appendChild(cell)
          } else {
            const parsed = parseSingleLength(cur)
            if (parsed) {
              // Number + unit for single lengths (font-size, gap, width…).
              const num = document.createElement('input')
              num.type = 'number'
              num.step = 'any'
              num.className = 'prop-value'
              num.value = String(parsed.num)
              const unit = document.createElement('select')
              unit.className = 'unit-select'
              for (const u of ['px', 'rem', 'em', '%', 'vh', 'vw', '']) {
                const o = document.createElement('option')
                o.value = u
                o.textContent = u || '—'
                if (u === parsed.unit) o.selected = true
                unit.appendChild(o)
              }
              const emit = () => {
                const next = num.value === '' ? '' : num.value + unit.value
                const edited = next !== val
                num.classList.toggle('edited', edited)
                unit.classList.toggle('edited', edited)
                applyEdit(next)
              }
              num.oninput = emit
              unit.onchange = emit
              row.append(num, unit)
            } else {
              const input = document.createElement('input')
              input.className = 'prop-value wide'
              input.value = cur
              input.classList.toggle('edited', cur !== val)
              input.oninput = () => {
                input.classList.toggle('edited', input.value !== val)
                applyEdit(input.value)
              }
              row.appendChild(input)
            }
          }
          list.appendChild(row)
        })
        body.appendChild(list)
      } else if (tabKey === 'classes') {
        // Chip editor: × removes a class, the dashed input adds one. All
        // changes preview live and record a single class styleEdit.
        const fromClasses = inspect.classes.join(' ')
        const current = (
          (styleEdits.get('class') && styleEdits.get('class').to) ||
          fromClasses
        )
          .split(/\s+/)
          .filter(Boolean)
        const wrap = document.createElement('div')
        wrap.className = 'class-chips'
        const applyClasses = () => {
          const next = current.join(' ').slice(0, 300)
          try {
            el.setAttribute('class', next)
          } catch {}
          styleEdits.set('class', { from: fromClasses, to: next })
          renderHighlight()
          render()
        }
        function render() {
          wrap.innerHTML = ''
          if (!current.length && !inspect.classes.length) {
            const empty = document.createElement('span')
            empty.className = 'i-empty2'
            empty.style.padding = '0'
            empty.textContent = 'No classes on this element.'
            wrap.appendChild(empty)
          }
          current.forEach((cl, i) => {
            const chip = document.createElement('span')
            chip.className = 'class-chip'
            const txt = document.createElement('span')
            txt.textContent = cl
            const x = document.createElement('span')
            x.className = 'x'
            x.textContent = '×'
            x.title = 'Remove class (live preview)'
            x.onclick = () => {
              current.splice(i, 1)
              applyClasses()
            }
            chip.append(txt, x)
            wrap.appendChild(chip)
          })
          const add = document.createElement('input')
          add.className = 'add-class'
          add.placeholder = '+ add class'
          add.onkeydown = (ev) => {
            if (ev.key !== 'Enter' && ev.key !== ' ') return
            ev.preventDefault()
            const token = add.value.trim()
            if (!token || /\s/.test(token) || !isSafeCssValue(token)) return
            current.push(token)
            applyClasses()
            // Re-focus the fresh input so several classes can be added in a row.
            const next = wrap.querySelector('.add-class')
            if (next) next.focus()
          }
          wrap.appendChild(add)
        }
        render()
        body.appendChild(wrap)
      } else {
        body.innerHTML = inspect.props
          ? Object.entries(inspect.props)
              .map(
                ([k, v]) =>
                  `<div class="rowkv"><span class="k" title="${esc(k)}">${esc(k)}</span><span class="v">${esc(v)}</span></div>`,
              )
              .join('')
          : '<div class="i-empty2">No React props found on this element.</div>'
      }
    }
    tabs.forEach((t) => {
      t.onclick = () => show(t.dataset.itab)
    })
    show('styles')
  }

  // ---- thread -----------------------------------------------------------
  // Inline SVG icons for the redesigned card (stroke follows currentColor).
  const ICONS = {
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    check:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    trash:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>',
    arrow:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px"><path d="M7 17L17 7M7 7h10v10"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
    image:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 11 8 11 8a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 1 12s4 8 11 8a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>',
    zoom: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M11 8v6M8 11h6"/></svg>',
  }

  // Standardized screenshot slot with an image badge (zoom icon on hover).
  function shotBoxHtml(url) {
    return `<div class="shot-box"><img class="thumb" src="${API}${esc(url)}" /><span class="shot-ico"><span class="i">${ICONS.image}</span><span class="z">${ICONS.zoom}</span></span></div>`
  }

  // Component path row: truncated one-liner that expands to the full,
  // never-cut breadcrumb (design: path-row/details).
  function pathRowHtml(c) {
    const compPath = (c.inspect && c.inspect.componentPath) || ''
    const parts = compPath ? compPath.split(' › ') : []
    const fallback =
      (c.inspect && c.inspect.tag) || (c.anchor && c.anchor.label) || ''
    if (!parts.length && !fallback) return ''
    const last = parts.length ? parts[parts.length - 1] : fallback
    const truncated =
      parts.length > 2
        ? `${esc(parts[0])} › … › <span class="cur">${esc(last)}</span>`
        : parts.length
          ? parts
              .map((p, i) =>
                i === parts.length - 1
                  ? `<span class="cur">${esc(p)}</span>`
                  : esc(p),
              )
              .join(' › ')
          : `<span class="cur">${esc(fallback)}</span>`
    const full = parts.length
      ? parts
          .map((p, i) =>
            i === parts.length - 1
              ? `<span class="cur">${esc(p)}</span>`
              : `<span>${esc(p)}</span>`,
          )
          .join('<span class="sep">›</span>')
      : `<span class="cur">${esc(fallback)}</span>`
    return `
      <div class="path-row">
        <details>
          <summary>
            <span class="trunc">${truncated}</span>
            <span class="hint2">full path</span>
            <div class="full-path"><span class="kind">Component</span><span class="sep">·</span>${full}</div>
          </summary>
        </details>
      </div>`
  }

  // Chips row: element tag, viewport, classes, suggested style edits.
  function metaStripHtml(c) {
    const chips = []
    if (c.inspect && c.inspect.tag)
      chips.push(
        `<span class="tag2 el">${esc(c.inspect.tag)}${c.inspect.id ? '#' + esc(c.inspect.id) : ''}</span>`,
      )
    if (c.inspect && c.inspect.viewport)
      chips.push(`<span class="tag2 mono">${esc(c.inspect.viewport)}</span>`)
    if (c.styleEdits && c.styleEdits.length)
      c.styleEdits.forEach((e2) => {
        chips.push(
          `<span class="tag2 mono edit" title="Suggested change">${esc(e2.prop)}: <s>${esc(e2.from)}</s> → <b>${esc(e2.to)}</b></span>`,
        )
      })
    const classes = (c.inspect && c.inspect.classes) || []
    const MAX = 6
    classes.slice(0, MAX).forEach((cl) => {
      chips.push(`<span class="tag2 mono">${esc(cl)}</span>`)
    })
    if (classes.length > MAX)
      chips.push(
        `<span class="tag2" title="${esc(classes.slice(MAX).join(' '))}">+${classes.length - MAX} classes</span>`,
      )
    return chips.length ? `<div class="meta-strip">${chips.join('')}</div>` : ''
  }

  function openThread(c, pos) {
    closePopover()
    activeCommentId = c.id
    pinnedEl = resolveAnchor(c.anchor).el
    renderHighlight()
    const pop = document.createElement('div')
    pop.className = 'popover card2'
    placePopover(pop, pos.x, pos.y)
    // Follow the anchored element on scroll (offset from anchor preserved).
    pop._follow = {
      anchor: c.anchor,
      dx: parseFloat(pop.style.left) - pos.x,
      dy: parseFloat(pop.style.top) - pos.y,
    }
    const replies = (c.replies || [])
      .map((r) =>
        messageRow(r.author, r.body, r.createdAt, {
          authorAvatar: r.authorAvatar || null,
          synced: !!r.linearSynced,
        }),
      )
      .join('')
    const target = c.issueRef ? `Send to ${esc(c.issueRef)}` : 'Send to Linear'
    // Linear control lives in the reply actions: push button before a push,
    // linked badge after, struck-through badge if deleted on the Linear side.
    const linearControl = c.linearDeleted
      ? `<span class="badge" style="text-decoration:line-through" title="This comment/issue was deleted in Linear">${esc(c.linear?.identifier || 'Linear')} deleted</span>`
      : c.linear
        ? `<a class="badge done" href="${esc(c.linear.url)}" target="_blank" title="Replies here also thread onto this Linear comment">${esc(c.linear.identifier)} ${ICONS.arrow}</a>`
        : `<button class="btn ghost" data-act="linear">${ICONS.arrow} ${target}</button>`
    pop.innerHTML = `
      <div class="card-header">
        <span class="ttl">Comment${c.status === 'resolved' ? ' · resolved' : ''}</span>
        <button class="icon-x" data-act="close" title="Close" aria-label="Close">${ICONS.x}</button>
      </div>
      ${pathRowHtml(c)}
      ${metaStripHtml(c)}
      <div class="body body-thread">
        <div class="thread-scroll">
          <div class="thread">
            ${messageRow(c.author, c.body, c.createdAt, {
              first: true,
              authorAvatar: c.authorAvatar || null,
              extraHtml:
                (c.imageUrl
                  ? `${c.afterImageUrl ? '<div class="shot-label">Current</div>' : ''}${shotBoxHtml(c.imageUrl)}`
                  : '') +
                (c.afterImageUrl
                  ? `<div class="shot-label">Suggested</div>${shotBoxHtml(c.afterImageUrl)}`
                  : ''),
            })}
            ${replies}
          </div>
        </div>
        <div class="reply-area2">
          <div class="reply-box">
            <textarea placeholder="Reply…" rows="2" aria-label="Reply"></textarea>
            <div class="reply-actions">
              ${linearControl}
              <button class="btn primary" data-act="reply">Reply</button>
            </div>
          </div>
        </div>
      </div>
      <div class="card-footer">
        ${c.status === 'resolved' ? '' : `<button class="footer-action success" data-act="resolve">${ICONS.check} Resolve</button>`}
        <button class="footer-action" data-act="copy-md" title="Copy this comment as Markdown (for AI tooling)">${ICONS.copy} <span>Copy</span></button>
        <span class="spacer"></span>
        <button class="footer-action danger" data-act="delete" title="Delete this DQA comment (does not touch Linear)">${ICONS.trash} Delete</button>
      </div>`
    ui.appendChild(pop)
    activePopover = pop
    makeDraggable(pop)
    wireThumbs(pop)
    // Scroll to the newest message (chat-style).
    const threadEl = pop.querySelector('.thread-scroll')
    if (threadEl) threadEl.scrollTop = threadEl.scrollHeight
    pop.querySelectorAll('[data-act="close"]').forEach((b) => {
      b.onclick = closePopover
    })
    pop.querySelector('[data-act="reply"]').onclick = async () => {
      const body = pop.querySelector('textarea').value.trim()
      if (!body) return
      await api(`/api/comments/${c.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      await loadComments()
      // Keep the conversation open: re-render the thread in place with the
      // new reply (placePopover applies a +16px x offset — compensate).
      const updated = comments.find((x) => x.id === c.id)
      if (updated)
        openThread(updated, {
          x: (parseInt(pop.style.left, 10) || 0) - 16,
          y: parseInt(pop.style.top, 10) || 0,
        })
      else closePopover()
    }
    const resolveBtn = pop.querySelector('[data-act="resolve"]')
    if (resolveBtn)
      resolveBtn.onclick = async () => {
        await api(`/api/comments/${c.id}/resolve`, { method: 'POST' })
        await loadComments()
        closePopover()
      }
    const deleteBtn = pop.querySelector('[data-act="delete"]')
    if (deleteBtn)
      deleteBtn.onclick = async () => {
        if (!window.confirm('Delete this DQA comment? (does not touch Linear)'))
          return
        await api(`/api/comments/${c.id}`, { method: 'DELETE' })
        await loadComments()
        closePopover()
      }
    const copyBtn = pop.querySelector('[data-act="copy-md"]')
    if (copyBtn)
      copyBtn.onclick = async () => {
        const ok = await copyText(commentMarkdown(c))
        const label = copyBtn.querySelector('span')
        if (label) label.textContent = ok ? 'Copied ✓' : 'Copy failed'
        setTimeout(() => {
          if (label) label.textContent = 'Copy'
        }, 1500)
      }
    const linearBtn = pop.querySelector('[data-act="linear"]')
    if (linearBtn) linearBtn.onclick = () => openPicker(c)
    if (EMBED) notifyState()
  }

  // ---- Linear ticket picker --------------------------------------------
  function openPicker(c) {
    const pop = activePopover
    if (!pop) return
    // Second view of the same card: swap the whole card for the Linear panel
    // (Back re-renders the thread view).
    pop.innerHTML = `
      <div class="card-header">
        <span class="ttl">Send to Linear</span>
        <button class="icon-x" data-act="close" title="Close" aria-label="Close">${ICONS.x}</button>
      </div>
      ${pathRowHtml(c)}
      <div class="body">
      <div class="linear-body">
        <div class="radio-row" role="radiogroup" aria-label="Push mode">
          <label class="opt"><input type="radio" name="dqa-action" value="comment" checked /> Comment</label>
          <label class="opt"><input type="radio" name="dqa-action" value="subissue" /> Sub-issue</label>
          <label class="opt"><input type="radio" name="dqa-action" value="issue" /> Triage issue</label>
        </div>
        <div class="action-row" style="margin-bottom:0">
          <select class="prio" title="Priority (for created issues)">
            <option value="0">No priority</option>
            <option value="1">Urgent</option>
            <option value="2">High</option>
            <option value="3" selected>Medium</option>
            <option value="4">Low</option>
          </select>
        </div>
        <div class="search-row">
          <input class="picker-search" placeholder="Search tickets…" aria-label="Search tickets" />
          <span class="search-spin" style="display:none" aria-hidden="true"></span>
        </div>
        <div class="picker-list" style="margin-top:0"><div class="picker-empty">Loading…</div></div>
      </div>
      </div>
      <div class="linear-footer">
        <button class="btn ghost" data-act="back">${ICONS.back} Back</button>
        <span class="spacer" style="flex:1"></span>
        <button class="btn primary" data-act="create" style="display:none">Create triage issue</button>
        ${ISSUE_REF ? `<button class="btn link" data-act="default">Use ${esc(ISSUE_REF)}</button>` : ''}
      </div>`
    const body = pop
    const search = body.querySelector('.picker-search')
    const list = body.querySelector('.picker-list')
    const prio = body.querySelector('.prio')
    const createBtn = body.querySelector('[data-act="create"]')
    const closeBtn = body.querySelector('[data-act="close"]')
    if (closeBtn) closeBtn.onclick = closePopover
    makeDraggable(pop)
    const currentAction = () =>
      body.querySelector('input[name="dqa-action"]:checked').value
    const opts = () => ({
      action: currentAction(),
      priority: Number(prio.value),
    })
    // "Triage issue" needs no target ticket — swap list interaction for a create button.
    body.querySelectorAll('input[name="dqa-action"]').forEach((r) => {
      r.onchange = () => {
        const isNew = currentAction() === 'issue'
        createBtn.style.display = isNew ? '' : 'none'
        search.style.display = isNew ? 'none' : ''
        list.style.display = isNew ? 'none' : ''
      }
    })
    createBtn.onclick = () => sendToLinear(c, null, opts())
    body.querySelector('[data-act="back"]').onclick = () =>
      openThread(c, resolveAnchor(c.anchor))
    const def = body.querySelector('[data-act="default"]')
    if (def) def.onclick = () => sendToLinear(c, ISSUE_REF, opts())
    const spin = body.querySelector('.search-spin')
    let debounceT
    let seq = 0 // ignore stale responses (fast typing)
    let nextCursor = null
    let currentTerm = ''
    let inflight = false
    function rowFor(it) {
      const row = document.createElement('div')
      row.className = 'picker-item'
      row.innerHTML = `<span class="pid">${esc(it.identifier)}</span><span class="pt">${esc(it.title)}</span>`
      row.onclick = () => sendToLinear(c, it.identifier, opts())
      return row
    }
    async function load(term, after) {
      const mySeq = ++seq
      inflight = true
      spin.style.display = ''
      if (!after) nextCursor = null
      try {
        const res = await api(
          `/api/linear/issues?term=${encodeURIComponent(term || '')}${after ? `&after=${encodeURIComponent(after)}` : ''}`,
        )
        if (mySeq !== seq) return // superseded by a newer search
        if (
          !res.ok ||
          !(res.headers.get('content-type') || '').includes('json')
        ) {
          list.innerHTML = `<div class="picker-empty">Couldn't load tickets (HTTP ${res.status}). Is the DQA service up to date? Try restarting it.</div>`
          return
        }
        const data = await res.json()
        if (mySeq !== seq) return
        if (data.dev) {
          list.innerHTML = `<div class="picker-empty">Dev mode — sign in with Linear to list tickets.</div>`
          return
        }
        const issues = data.issues || []
        if (after) {
          const more = list.querySelector('.picker-more')
          if (more) more.remove()
        } else if (!issues.length) {
          list.innerHTML = `<div class="picker-empty">No tickets found.</div>`
          return
        } else {
          list.innerHTML = ''
        }
        issues.forEach((it) => {
          list.appendChild(rowFor(it))
        })
        nextCursor = data.nextCursor || null
        if (nextCursor) {
          const more = document.createElement('div')
          more.className = 'picker-more'
          more.textContent = 'Scroll for more…'
          list.appendChild(more)
        }
      } catch (e) {
        if (mySeq === seq)
          list.innerHTML = `<div class="picker-empty">Error: ${esc(e.message)}</div>`
      } finally {
        if (mySeq === seq) {
          spin.style.display = 'none'
          inflight = false
        }
      }
    }
    // Infinite scroll: fetch the next cursor page near the bottom.
    list.addEventListener('scroll', () => {
      if (!nextCursor || inflight) return
      if (list.scrollTop + list.clientHeight >= list.scrollHeight - 60)
        load(currentTerm, nextCursor)
    })
    search.addEventListener('input', () => {
      clearTimeout(debounceT)
      debounceT = setTimeout(() => {
        currentTerm = search.value.trim()
        load(currentTerm)
      }, 250)
    })
    search.focus()
    load('')
  }

  async function sendToLinear(c, issueRef, opts) {
    try {
      const data = await (
        await api(`/api/comments/${c.id}/linear`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            issueRef,
            action: opts && opts.action,
            priority: opts && opts.priority,
          }),
        })
      ).json()
      if (data.issue) {
        alert(
          `Linear (${data.mode || 'comment'}): ${data.issue.identifier}\n${data.issue.url}${data.dryRun ? '\n\n(dry run)' : ''}`,
        )
        // Return to the thread view — it now shows the linked badge, and
        // subsequent replies will thread onto the Linear comment.
        await loadComments()
        const updated = comments.find((x) => x.id === c.id)
        if (updated) {
          openThread(updated, resolveAnchor(updated.anchor))
          return
        }
      } else alert('Linear error: ' + (data.error || 'unknown'))
    } catch (e) {
      alert('Linear error: ' + e.message)
    }
    closePopover()
  }

  // Full-size screenshot viewer — thumbnails in the 380px card are often too
  // small to read. Click a thumb to magnify; click anywhere or Esc closes.
  function openLightbox(src, caption) {
    const box = document.createElement('div')
    box.className = 'lightbox'
    const img = document.createElement('img')
    img.src = src
    img.alt = caption || 'Screenshot'
    box.appendChild(img)
    if (caption) {
      const cap = document.createElement('div')
      cap.className = 'lb-cap'
      cap.textContent = `${caption} — click anywhere or press Esc to close`
      box.appendChild(cap)
    }
    const close = () => {
      box.remove()
      window.removeEventListener('keydown', onKey, true)
    }
    const onKey = (ev) => {
      if (ev.key === 'Escape') {
        ev.stopPropagation()
        close()
      }
    }
    box.onclick = close
    window.addEventListener('keydown', onKey, true)
    ui.appendChild(box)
  }

  // Make every screenshot thumbnail inside a popover magnifiable.
  function wireThumbs(pop) {
    pop.querySelectorAll('.shot-box').forEach((box) => {
      box.title = 'Click to magnify'
      box.onclick = (ev) => {
        ev.stopPropagation()
        const img = box.querySelector('img')
        if (!img) return
        // Use the preceding shot label ("Current" / "Suggested") as caption.
        const label = box.previousElementSibling
        openLightbox(
          img.src,
          label && label.classList.contains('shot-label')
            ? label.textContent
            : 'Screenshot',
        )
      }
    })
  }

  function placePopover(pop, x, y) {
    pop.style.left =
      Math.max(8, Math.min(x + 16, window.innerWidth - 364)) + 'px'
    pop.style.top = Math.max(8, Math.min(y, window.innerHeight - 320)) + 'px'
  }

  // Popovers are draggable by their header (they can cover the element under
  // review, or open partly off-screen near the viewport edges).
  function makeDraggable(pop) {
    const head = pop.querySelector('.head, .card-header')
    if (!head) return
    head.style.cursor = 'move'
    head.addEventListener('pointerdown', (e) => {
      if (
        e.target.closest &&
        e.target.closest('button, a, input, select, textarea')
      )
        return
      e.preventDefault()
      const startX = e.clientX,
        startY = e.clientY
      const rect = pop.getBoundingClientRect()
      const move = (ev) => {
        pop.style.left =
          Math.max(
            4,
            Math.min(rect.left + (ev.clientX - startX), window.innerWidth - 80),
          ) + 'px'
        pop.style.top =
          Math.max(
            4,
            Math.min(rect.top + (ev.clientY - startY), window.innerHeight - 40),
          ) + 'px'
      }
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        // Re-base the scroll-follow offset on the dragged position so the
        // card keeps following the element from where the user left it.
        const f = pop._follow
        if (f && f.anchor) {
          const p = resolveAnchor(f.anchor)
          if (p) {
            f.dx = parseFloat(pop.style.left) - p.x
            f.dy = parseFloat(pop.style.top) - p.y
          }
        }
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    })
  }
  function closePopover() {
    if (activePopover) {
      activePopover.remove()
      activePopover = null
    }
    if (draft && draft.revert) {
      try {
        draft.revert()
      } catch {}
    }
    draft = null
    pinnedEl = null
    activeCommentId = null
    renderHighlight()
    if (EMBED) notifyState()
  }

  function focusCommentById(id) {
    const c = comments.find((x) => x.id === id)
    if (!c || !c.anchor) return
    const pos = resolveAnchor(c.anchor)
    if (pos.el && pos.el.scrollIntoView) {
      try {
        pos.el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      } catch {}
    }
    activeCommentId = id
    notifyState()
    openThread(c, pos)
  }

  // ---- network ----------------------------------------------------------
  async function loadComments() {
    try {
      const res = await api(`/api/comments?url=${encodeURIComponent(PAGE_URL)}`)
      comments = await res.json()
      renderPins()
      if (EMBED) notifyState()
    } catch {}
  }
  async function postComment({
    body,
    anchor,
    imageUrl,
    afterImageUrl,
    inspect,
    styleEdits,
  }) {
    const res = await api('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: PAGE_URL,
        body,
        anchor,
        imageUrl,
        afterImageUrl,
        issueRef: ISSUE_REF,
        inspect,
        styleEdits,
      }),
    })
    return res.json()
  }
  async function uploadImage(file) {
    const fd = new FormData()
    fd.append('image', file)
    return (
      await (await api('/api/upload', { method: 'POST', body: fd })).json()
    ).imageUrl
  }

  // ---- click-to-comment -------------------------------------------------
  // The overlay itself and anything marked data-dqa-ignore (the DevDrawer,
  // its trigger, other devtools chrome) are never commentable.
  function inOverlayOrIgnored(e) {
    return e
      .composedPath()
      .some(
        (n) =>
          n === host ||
          (n &&
            n.nodeType === 1 &&
            n.hasAttribute &&
            n.hasAttribute('data-dqa-ignore')),
      )
  }
  document.addEventListener(
    'click',
    (e) => {
      if (!commentMode) return
      if (inOverlayOrIgnored(e)) return
      e.preventDefault()
      e.stopPropagation()
      // Resolve the element by coordinates (same mechanism as hover) rather
      // than trusting e.target: apps that re-render on interaction (portal)
      // can swap the pressed node between mousedown and click, which makes
      // the browser retarget the click to a common ancestor like #app.
      let el = document.elementFromPoint(e.clientX, e.clientY)
      if (
        !el ||
        el === host ||
        (el.closest && el.closest('[data-dqa-ignore]'))
      ) {
        el = null
      }
      // Fall back to the tracked hover element, then the raw click target.
      if (!el && hoverEl && document.contains(hoverEl)) el = hoverEl
      if (!el) el = e.target
      openCompose(captureAnchor(el, e.clientX, e.clientY), e.clientX, e.clientY)
      setMode(false)
    },
    true,
  )

  // ---- websocket --------------------------------------------------------
  const cursorEls = new Map()
  function connect() {
    if (!TOKEN) return
    ws = new WebSocket(WS_URL)
    ws.onopen = () =>
      ws.send(JSON.stringify({ type: 'join', url: PAGE_URL, token: TOKEN }))
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.type === 'unauthorized') return signOut()
      if (msg.type === 'cursor') moveCursor(msg.user, msg.x, msg.y)
      else if (msg.type === 'presence') {
        msg.users.forEach((u) => {
          ensureCursor(u)
        })
        renderPresence()
      } else if (msg.type === 'join') {
        ensureCursor(msg.user)
        renderPresence()
      } else if (msg.type === 'leave') {
        removeCursor(msg.user)
        renderPresence()
      } else if (
        msg.type === 'comment:new' ||
        msg.type === 'comment:update' ||
        msg.type === 'comment:delete'
      )
        loadComments()
    }
    ws.onclose = () => {
      if (TOKEN) setTimeout(connect, 2000)
    }
  }

  // ---- SPA route changes ------------------------------------------------
  // Client-side navigations (TanStack Router etc.) don't reload, so we must
  // re-scope to the new path: reload that page's comments and re-join the WS
  // room. Otherwise the previous page's pins linger.
  function onRouteMaybeChanged() {
    const next = location.origin + location.pathname
    if (next === PAGE_URL) return
    PAGE_URL = next
    closePopover()
    comments = []
    renderPins()
    activeCommentId = null
    if (outlineAll) renderOutlineAll()
    if (USER) {
      loadComments()
      // Re-join the room for the new page (server rooms are keyed by url).
      if (ws && ws.readyState === 1)
        ws.send(JSON.stringify({ type: 'join', url: PAGE_URL, token: TOKEN }))
    }
    notifyState()
  }
  for (const m of ['pushState', 'replaceState']) {
    const orig = history[m]
    history[m] = function (...args) {
      const r = orig.apply(this, args)
      queueMicrotask(onRouteMaybeChanged)
      return r
    }
  }
  window.addEventListener('popstate', onRouteMaybeChanged)
  window.addEventListener('hashchange', onRouteMaybeChanged)

  function ensureCursor(user) {
    if (!user || cursorEls.has(user.id)) return cursorEls.get(user.id)
    const c = document.createElement('div')
    c.className = 'cursor'
    if (user.avatarUrl) c.dataset.avatarUrl = user.avatarUrl
    c.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24"><path fill="${user.color || '#2563eb'}" d="M3 2l7 18 2.5-7.5L20 10z"/></svg><span class="tag" style="background:${user.color || '#2563eb'}">${esc(user.name)}</span>`
    cursorsLayer.appendChild(c)
    cursorEls.set(user.id, c)
    return c
  }
  function moveCursor(user, x, y) {
    const c = ensureCursor(user)
    c.style.transform = `translate(${x * window.innerWidth}px, ${y * window.innerHeight}px)`
  }
  function removeCursor(user) {
    const c = user && cursorEls.get(user.id)
    if (c) {
      c.remove()
      cursorEls.delete(user.id)
    }
  }

  // ---- mousemove: cursor broadcast + highlight --------------------------
  let lastSend = 0
  document.addEventListener('mousemove', (e) => {
    const now = Date.now()
    if (ws && ws.readyState === 1 && now - lastSend >= 40) {
      lastSend = now
      ws.send(
        JSON.stringify({
          type: 'cursor',
          x: e.clientX / window.innerWidth,
          y: e.clientY / window.innerHeight,
        }),
      )
    }
    if (commentMode && !inOverlayOrIgnored(e)) {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      if (el && el.closest && el.closest('[data-dqa-ignore]')) return
      if (el && el !== hoverEl) {
        hoverEl = el
        renderHighlight()
      }
    }
  })

  // ---- toolbar (legacy floating chrome — disabled in DevDrawer embed mode) ----
  function renderToolbar() {
    if (!USER) return
    if (EMBED) {
      notifyState()
      return
    }
    let tb = root.querySelector('.toolbar')
    if (!tb) {
      tb = document.createElement('div')
      tb.className = 'toolbar'
      ui.appendChild(tb)
    }
    const open = getOpenCount()
    tb.innerHTML = `
      <button class="mode${commentMode ? ' active' : ''}" data-act="mode">${commentMode ? 'Pick an element' : 'Inspect'}</button>
      <div class="presence"></div>
      <span class="count">${open} open</span>
      <button class="icon-btn" data-act="pins" title="${showPins ? 'Hide comment bubbles on the page' : 'Show comment bubbles on the page'}">${showPins ? ICONS.eye : ICONS.eyeOff}</button>
      <button class="icon-btn" data-act="signout" title="Sign out (${esc(USER.name)})">⏻</button>`
    tb.querySelector('[data-act="mode"]').onclick = () => setMode(!commentMode)
    tb.querySelector('[data-act="pins"]').onclick = () => setShowPins(!showPins)
    tb.querySelector('[data-act="signout"]').onclick = signOut
    renderPresence(tb)
  }
  function renderPresence(tb) {
    tb = tb || root.querySelector('.toolbar')
    if (!tb) return
    const box = tb.querySelector('.presence')
    if (!box || !USER) return
    box.innerHTML = ''
    const av = document.createElement('div')
    av.className = 'avatar'
    av.title = USER.name + ' (you)'
    fillAvatar(av, {
      name: USER.name,
      avatarUrl: USER.avatarUrl,
      color: USER.color || avatarColor(USER.name),
    })
    box.appendChild(av)
    cursorEls.forEach((el) => {
      const tag = el.querySelector('.tag')
      const a = document.createElement('div')
      a.className = 'avatar'
      a.title = tag ? tag.textContent : ''
      fillAvatar(a, {
        name: tag ? tag.textContent : '?',
        avatarUrl: el.dataset.avatarUrl || null,
        color: tag ? tag.style.background : '#777',
      })
      box.appendChild(a)
    })
    if (EMBED) notifyState()
  }
  // Inspect mode: crosshair cursor page-wide (like picking in devtools).
  let cursorStyleEl = null
  function setPageCursor(on) {
    if (on && !cursorStyleEl) {
      cursorStyleEl = document.createElement('style')
      cursorStyleEl.textContent =
        '*, *::before, *::after { cursor: crosshair !important; }'
      document.head.appendChild(cursorStyleEl)
    } else if (!on && cursorStyleEl) {
      cursorStyleEl.remove()
      cursorStyleEl = null
    }
  }
  function setMode(on) {
    commentMode = on
    if (!on) hoverEl = null
    renderToolbar()
    renderHighlight()
    showHint(on)
    setPageCursor(on)
  }
  let hintEl
  function showHint(on) {
    if (hintEl) {
      hintEl.remove()
      hintEl = null
    }
    if (on) {
      hintEl = document.createElement('div')
      hintEl.className = 'hint'
      hintEl.textContent =
        'Inspect — click any element to comment · C to toggle · Esc to cancel'
      ui.appendChild(hintEl)
    }
  }
  // True when the keystroke belongs to a text field (page or overlay side) —
  // shortcuts must never fire while someone is typing.
  function isTypingTarget(e) {
    const t = e.composedPath ? e.composedPath()[0] : e.target
    if (!t || t.nodeType !== 1) return false
    const tag = t.tagName
    return (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      t.isContentEditable
    )
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      setMode(false)
      closePopover()
      return
    }
    // "C" toggles comment/inspect mode (Figma/Vercel-toolbar convention).
    // Plain keypress only — no modifiers, never while typing, signed-in only.
    if (
      (e.key === 'c' || e.key === 'C') &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      !e.shiftKey &&
      USER &&
      !activePopover &&
      !isTypingTarget(e)
    ) {
      e.preventDefault()
      setMode(!commentMode)
    }
  })

  function esc(s) {
    return String(s == null ? '' : s).replace(
      /[&<>"]/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
    )
  }

  // Deterministic avatar colour + initial from a name (matches the drawer's palette).
  const AVATAR_COLORS = [
    '#0080bc', // ens-lapis-core
    '#007c23', // ens-peridot-core
    '#8a0a49', // ens-garnet-dense
    '#b35600', // ens-citrine-600
    '#674d49', // ens-bronzite-core
    '#093c52', // ens-lapis-dense
    '#f53293', // ens-garnet-core
    '#c82e1f', // ens-signal-danger-500
  ]
  function avatarColor(name) {
    let h = 0
    for (const ch of String(name || '?')) h = (h * 31 + ch.charCodeAt(0)) >>> 0
    return AVATAR_COLORS[h % AVATAR_COLORS.length]
  }
  function initial(name) {
    return (String(name || '?').trim()[0] || '?').toUpperCase()
  }

  /** Fill a container with a Linear avatar image or a colored letter fallback. */
  function fillAvatar(el, { name, avatarUrl, color, letterClass }) {
    const bg = color || avatarColor(name)
    const letter = initial(name)
    el.replaceChildren()
    el.style.background = bg
    if (avatarUrl) {
      const img = document.createElement('img')
      img.src = avatarUrl
      img.alt = ''
      img.referrerPolicy = 'no-referrer'
      img.draggable = false
      img.onerror = () => {
        el.replaceChildren()
        el.style.background = bg
        if (letterClass) {
          const span = document.createElement('span')
          span.className = letterClass
          span.textContent = letter
          el.appendChild(span)
        } else {
          el.textContent = letter
        }
      }
      el.appendChild(img)
      return
    }
    if (letterClass) {
      const span = document.createElement('span')
      span.className = letterClass
      span.textContent = letter
      el.appendChild(span)
    } else {
      el.textContent = letter
    }
  }

  // ---- Markdown export (AI-tooling friendly) ------------------------------
  // Compact, LLM-oriented serialization: only what an agent needs to locate
  // and fix the issue (instruction, route, component, selector, classes,
  // suggested edits, replies). No authors/timestamps/URLs — they cost tokens
  // and don't change the fix.
  function commentMarkdown(c, index) {
    const inspect = c.inspect || null
    const lines = []
    const idx = index != null ? `${index}. ` : ''
    let route = c.url
    try {
      const u = new URL(c.url)
      route = u.pathname + u.search
    } catch {}
    const status = c.status === 'resolved' ? ' [resolved]' : ''
    lines.push(
      `${idx}QA: ${String(c.body || '')
        .split('\n')
        .join(' ')
        .trim()}${status}`,
    )
    lines.push(`page: ${route}`)
    if (inspect && inspect.componentPath)
      lines.push(`component: ${inspect.componentPath}`)
    if (c.anchor && c.anchor.selector)
      lines.push(`element: ${c.anchor.selector}`)
    if (inspect && inspect.classes && inspect.classes.length)
      lines.push(`classes: ${inspect.classes.join(' ')}`)
    if (c.styleEdits && c.styleEdits.length) {
      lines.push('suggested changes:')
      for (const e of c.styleEdits)
        lines.push(`  ${e.prop}: ${e.from} -> ${e.to}`)
    }
    if (c.replies && c.replies.length) {
      lines.push('replies:')
      for (const r of c.replies)
        lines.push(
          `  - ${String(r.body || '')
            .split('\n')
            .join(' ')
            .trim()}`,
        )
    }
    if (c.linear && c.linear.identifier)
      lines.push(
        `linear: ${c.linear.identifier}${c.linearDeleted ? ' (deleted)' : ''}`,
      )
    return lines.join('\n')
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fallback for non-secure contexts.
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.cssText = 'position:fixed;opacity:0'
        document.body.appendChild(ta)
        ta.select()
        const ok = document.execCommand('copy')
        ta.remove()
        return ok
      } catch {
        return false
      }
    }
  }

  function avatarHtml(name, avatarUrl, color) {
    const bg = color || avatarColor(name)
    const letter = esc(initial(name))
    if (avatarUrl) {
      return `<div class="av" style="background:${bg}"><img src="${esc(avatarUrl)}" alt="" referrerpolicy="no-referrer" onerror="this.remove();this.parentElement.textContent='${letter}'" /></div>`
    }
    return `<div class="av" style="background:${bg}">${letter}</div>`
  }

  // Short relative time ("just now", "5m", "3h", "2d") with an absolute title.
  function relTime(iso) {
    const t = Date.parse(iso)
    if (!t) return ''
    const s = Math.max(0, (Date.now() - t) / 1000)
    if (s < 45) return 'just now'
    if (s < 3600) return Math.round(s / 60) + 'm'
    if (s < 86400) return Math.round(s / 3600) + 'h'
    if (s < 604800) return Math.round(s / 86400) + 'd'
    return new Date(t).toLocaleDateString()
  }
  function absTime(iso) {
    const t = Date.parse(iso)
    return t ? new Date(t).toLocaleString() : ''
  }

  // One chat message row: coloured avatar + author · time + body (+ optional images).
  function messageRow(
    author,
    body,
    createdAt,
    { first = false, extraHtml = '', authorAvatar = null, synced = false } = {},
  ) {
    return `
      <div class="msg${first ? ' first' : ''}">
        ${avatarHtml(author, authorAvatar)}
        <div class="bubble">
          <div class="meta"><span class="who">${esc(author)}</span><span class="when" title="${esc(absTime(createdAt))}">${esc(relTime(createdAt))}</span>${synced ? '<span class="synced-dot" title="Also posted to Linear as a threaded reply">↗ Linear</span>' : ''}</div>
          <div class="txt">${esc(body)}</div>
          ${extraHtml}
        </div>
      </div>`
  }

  // refresh toolbar counts periodically (only when signed in)
  setInterval(() => {
    if (!USER) return
    if (EMBED) notifyState()
    else renderToolbar()
  }, 1500)

  window.__DQA__ = {
    subscribe(cb) {
      listeners.add(cb)
      cb(getState())
      return () => listeners.delete(cb)
    },
    getState,
    setCommentMode(on) {
      setMode(!!on)
    },
    signOut,
    startLinearLogin,
    switchLinearAccount,
    devLogin,
    fetchAuthConfig,
    focusComment(id) {
      focusCommentById(id)
    },
    setActiveComment(id) {
      activeCommentId = id || null
      notifyState()
    },
    setTheme,
    // Markdown export (for AI tooling / sharing). Callers own the clipboard
    // write so it happens inside their user-gesture context.
    getCommentMarkdown(id) {
      const c = comments.find((x) => x.id === id)
      return c ? commentMarkdown(c) : null
    },
    getAllCommentsMarkdown() {
      const list = comments.filter((c) => c.anchor)
      if (!list.length) return null
      let route = PAGE_URL
      try {
        const u = new URL(PAGE_URL)
        route = u.pathname + u.search
      } catch {}
      return [
        `Design QA comments for ${route} (${list.length}):`,
        '',
        list.map((c, i) => commentMarkdown(c, i + 1)).join('\n\n'),
      ].join('\n')
    },
    async resolveComment(id) {
      await api(`/api/comments/${id}/resolve`, { method: 'POST' })
      await loadComments()
    },
    async deleteComment(id) {
      await api(`/api/comments/${id}`, { method: 'DELETE' })
      await loadComments()
    },
    setShowPins,
    setShowResolved(on) {
      showResolved = !!on
      try {
        localStorage.setItem('dqa_show_resolved', showResolved ? '1' : '0')
      } catch {}
      renderPins()
      notifyState()
    },
    setHighlightAll(on) {
      setOutlineAll(on)
    },
    getElementTree() {
      return getElementTree()
    },
    hoverElement(uid) {
      hoverElement(uid)
    },
    clearHoverElement() {
      clearHoverElement()
    },
    commentOnElement(uid) {
      commentOnElement(uid)
    },
    async getPages() {
      try {
        return await (await api('/api/pages')).json()
      } catch {
        return []
      }
    },
    navigateTo(url) {
      try {
        const u = new URL(url, location.href)
        if (u.origin !== location.origin) return // same-origin only
        // Full navigation — reliable across any router; the overlay re-inits
        // on load and scopes to the new page.
        location.assign(u.href)
      } catch {}
    },
  }

  init()
  console.log(
    '%c[DQA] overlay ready',
    'color:#111827;font-weight:bold',
    '→',
    API,
  )
})()
