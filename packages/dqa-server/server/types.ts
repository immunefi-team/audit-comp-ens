// Shared domain types for the DQA server. Type-only module (erased at runtime
// by Node's native TypeScript stripping).

export type StyleEdit = {
  prop: string
  from: string
  to: string
}

export type Inspect = {
  tag: string
  id: string | null
  classes: string[]
  styles: Record<string, string>
  props: Record<string, string> | null
  componentPath: string | null
  viewport: string | null
  text: string | null
}

export type Anchor = {
  selector: string
  label?: string
  offsetX?: number
  offsetY?: number
  pageXPct?: number
  pageYPct?: number
}

export type Reply = {
  id: string
  author: string
  /** Linear profile image URL when available; letter fallback otherwise. */
  authorAvatar?: string | null
  body: string
  createdAt: string
  /** True when the reply was also posted to Linear as a threaded reply. */
  linearSynced?: boolean
}

/** A pushed Linear comment or issue reference stored on a comment. */
export type LinearRef = {
  id?: string
  identifier?: string
  url?: string
  commentId?: string
  issueId?: string
  team?: { id: string }
}

export type Comment = {
  id: string
  url: string
  author: string
  authorId: string
  /** Linear profile image URL when available; letter fallback otherwise. */
  authorAvatar?: string | null
  body: string
  anchor: Anchor | null
  imageUrl: string | null
  afterImageUrl: string | null
  issueRef: string | null
  inspect: Inspect | null
  styleEdits: StyleEdit[] | null
  status: 'open' | 'resolved'
  replies: Reply[]
  linear: LinearRef | null
  linearDeleted?: boolean
  linearCheckedAt?: number
  createdAt: string
}

/** Short-lived signed JWT carrying the OAuth round-trip origin/returnUrl. */
export type OAuthState = {
  origin: string | null
  returnUrl: string | null
  n: string
  iat?: number
  exp?: number
}

/** DQA session payload embedded in the signed JWT. */
export type Session = {
  sub: string
  name: string
  email: string | null
  orgId: string | null
  color: string
  /** Linear profile image URL when the viewer has one. */
  avatarUrl?: string | null
  /** Encrypted Linear access token (server-only), or null for dev sessions. */
  lt: string | null
  dev: boolean
  iat?: number
  exp?: number
}

export type LinearViewer = {
  id: string
  name: string
  email?: string | null
  avatarUrl?: string | null
  organization?: { id: string; name?: string; urlKey?: string } | null
  teamMemberships?: {
    nodes: { team: { id: string; key: string; name: string } }[]
  }
}

export type LinearPushMode = 'comment' | 'subissue' | 'issue'
