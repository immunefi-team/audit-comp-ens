export type DqaUser = {
  readonly id: string
  readonly name: string
  readonly color?: string
  readonly avatarUrl?: string | null
}

export type DqaAuthConfig = {
  readonly oauthConfigured: boolean
  readonly devAllowed: boolean
  /** Delegated-auth origin sign-in popups open against (per-PR envs); null/absent = own origin. */
  readonly authOrigin?: string | null
}

/** A page (route) that has DQA comments. */
export type DqaPageSummary = {
  readonly url: string
  readonly open: number
  readonly total: number
}

/** A node in the page's element hierarchy (DevTools-style tree). */
export type DqaElementNode = {
  readonly uid: number
  readonly tag: string
  readonly label: string
  readonly component: string | null
  readonly hidden: boolean
  readonly children: readonly DqaElementNode[]
}

export type DqaCommentSummary = {
  readonly id: string
  readonly pinIndex: number
  readonly body: string
  readonly author: string
  readonly authorId?: string | null
  readonly authorAvatar?: string | null
  readonly status: 'open' | 'resolved'
  readonly anchorLabel?: string
  readonly replyCount: number
  readonly createdAt: string
  readonly issueRef?: string | null
  readonly linear?: { readonly identifier: string; readonly url: string } | null
  /** The pushed Linear comment/issue was deleted on the Linear side. */
  readonly linearDeleted?: boolean
}

export type DqaState = {
  readonly ready: boolean
  readonly loading: boolean
  readonly authenticated: boolean
  readonly user: DqaUser | null
  readonly commentMode: boolean
  readonly openCount: number
  readonly presence: readonly DqaUser[]
  readonly authConfig: DqaAuthConfig | null
  readonly signInError: string | null
  readonly comments: readonly DqaCommentSummary[]
  readonly activeCommentId: string | null
  readonly pageIssueRef: string | null
  /** The current page (origin + pathname) comments are scoped to. */
  readonly pageUrl?: string
  /** Overlay chrome theme (popovers, pins). Dark by default. */
  readonly theme?: 'dark' | 'light'
  /** Whether resolved comments' pins render on the page. */
  readonly showResolved?: boolean
  /** Whether comment pins (bubbles) render on the page at all. */
  readonly showPins?: boolean
  /** Whether all commentable elements are outlined on the page. */
  readonly outlineAll?: boolean
}

export type DqaApi = {
  readonly subscribe: (cb: (state: DqaState) => void) => () => void
  readonly getState: () => DqaState
  readonly setCommentMode: (on: boolean) => void
  readonly signOut: () => Promise<void>
  readonly startLinearLogin: () => void
  readonly switchLinearAccount: () => void
  readonly devLogin: (name?: string) => Promise<void>
  readonly fetchAuthConfig: () => Promise<DqaAuthConfig>
  readonly focusComment: (id: string) => void
  readonly setActiveComment: (id: string | null) => void
  /** Optional (newer overlay versions): switch overlay chrome theme. */
  readonly setTheme?: (theme: 'dark' | 'light') => void
  /** Optional (newer overlay versions): resolve a comment from the panel. */
  readonly resolveComment?: (id: string) => Promise<void>
  /** Optional (newer overlay versions): delete a DQA comment (local only). */
  readonly deleteComment?: (id: string) => Promise<void>
  /** Optional (newer overlay versions): toggle resolved pins on the page. */
  readonly setShowResolved?: (on: boolean) => void
  /** Optional (newer overlay versions): show/hide all comment bubbles. */
  readonly setShowPins?: (on: boolean) => void
  /** Optional (newer overlay versions): outline all commentable elements. */
  readonly setHighlightAll?: (on: boolean) => void
  /** Optional (newer overlay versions): element-hierarchy navigator. */
  readonly getElementTree?: () => DqaElementNode[]
  readonly hoverElement?: (uid: number) => void
  readonly clearHoverElement?: () => void
  readonly commentOnElement?: (uid: number) => void
  /** Optional (newer overlay versions): pages navigator. */
  readonly getPages?: () => Promise<DqaPageSummary[]>
  readonly navigateTo?: (url: string) => void
  /** Optional (newer overlay versions): Markdown export for AI tooling. */
  readonly getCommentMarkdown?: (id: string) => string | null
  readonly getAllCommentsMarkdown?: () => string | null
}

declare global {
  interface Window {
    __DQA__?: DqaApi
    /** Set by `@ens-apps/dev-dqa-overlay` before loading overlay.js in DevDrawer mode. */
    __DQA_EMBED__?: 'drawer'
    __DQA_OVERLAY__?: boolean
  }
}
