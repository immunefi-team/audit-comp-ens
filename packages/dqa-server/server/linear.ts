// Linear integration.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Comment, LinearPushMode, LinearRef } from './types.ts'

const LINEAR_API = 'https://api.linear.app/graphql'
const UPLOAD_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../data/uploads',
)
// Cap outbound Linear requests so an upstream outage can't hang a push/upload.
const LINEAR_FETCH_TIMEOUT_MS = 10_000
const UPLOAD_TIMEOUT_MS = 30_000 // image PUT can be larger; allow more

const FILE_UPLOAD = `
  mutation FileUpload($contentType: String!, $filename: String!, $size: Int!) {
    fileUpload(contentType: $contentType, filename: $filename, size: $size) {
      success
      uploadFile { uploadUrl assetUrl headers { key value } }
    }
  }`

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}

/**
 * Upload a local screenshot to Linear's file storage and return its assetUrl.
 * Required because DQA often runs on localhost/private hosts that Linear's
 * image proxy cannot reach — embedding our own URL renders a broken image.
 */
async function uploadImageToLinear(
  token: string,
  localUrl: string | null,
): Promise<string | null> {
  try {
    if (!localUrl || !localUrl.startsWith('/uploads/')) return null
    const file = resolve(UPLOAD_DIR, basename(localUrl))
    if (!existsSync(file)) return null
    const contentType =
      CONTENT_TYPES[extname(file).toLowerCase()] || 'image/png'
    const size = statSync(file).size
    const data = await gql(FILE_UPLOAD, token, {
      contentType,
      filename: basename(file),
      size,
    })
    const uf = data.fileUpload?.uploadFile
    if (!data.fileUpload?.success || !uf?.uploadUrl) {
      console.warn(
        '[linear] fileUpload mutation refused:',
        JSON.stringify(data.fileUpload ?? null),
      )
      return null
    }
    // Content-Length is set automatically by fetch from the body.
    const headers: Record<string, string> = { 'Content-Type': contentType }
    for (const h of uf.headers || []) headers[h.key] = h.value
    const put = await fetch(uf.uploadUrl, {
      method: 'PUT',
      headers,
      body: readFileSync(file),
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    })
    if (!put.ok) {
      console.warn(
        '[linear] upload PUT failed:',
        put.status,
        (await put.text().catch(() => '')).slice(0, 200),
      )
      return null
    }
    console.log('[linear] uploaded', basename(file), '→', uf.assetUrl)
    return uf.assetUrl
  } catch (e) {
    console.warn('[linear] image upload failed:', (e as Error).message)
    return null
  }
}

// Resolve a comment's screenshot to a URL Linear can render: prefer Linear's
// own storage, fall back to an absolute URL on our host (works when hosted
// publicly; never works for localhost).
async function resolveMediaUrl(
  token: string | null,
  localUrl: string | null,
  baseUrl?: string,
): Promise<string | null> {
  if (!localUrl) return null
  const uploaded = token ? await uploadImageToLinear(token, localUrl) : null
  if (uploaded) return uploaded
  return baseUrl ? `${baseUrl}${localUrl}` : localUrl
}

const ISSUE_CREATE = `
  mutation IssueCreate($input: IssueCreateInput!) {
    issueCreate(input: $input) { success issue { id identifier url title } }
  }`

const COMMENT_CREATE = `
  mutation CommentCreate($input: CommentCreateInput!) {
    commentCreate(input: $input) { success comment { id url } }
  }`

const ISSUE_BY_KEY_NUMBER = `
  query($key: String!, $number: Float!) {
    issues(filter: { team: { key: { eq: $key } }, number: { eq: $number } }, first: 1) {
      nodes { id identifier url title team { id } }
    }
  }`

const ISSUES_LIST = `
  query($filter: IssueFilter, $after: String) {
    issues(first: 50, after: $after, orderBy: updatedAt, filter: $filter) {
      nodes { id identifier title }
      pageInfo { hasNextPage endCursor }
    }
  }`

/**
 * Build an IssueFilter for a search term. Title-contains alone is useless for
 * how people actually search — they type identifiers. So:
 *   "WEB-656"  → that exact issue (team key + number), plus title matches
 *   "WEB-"/"web" → all of team WEB's recent issues, plus title matches
 *   anything else → title contains (unchanged)
 */
function termToFilter(term: string): Record<string, unknown> {
  const exact = term.match(/^([A-Za-z][A-Za-z0-9]*)-(\d+)$/)
  if (exact) {
    return {
      or: [
        {
          and: [
            { team: { key: { eqIgnoreCase: exact[1] } } },
            { number: { eq: Number(exact[2]) } },
          ],
        },
        { title: { containsIgnoreCase: term } },
      ],
    }
  }
  const teamKey = term.match(/^([A-Za-z][A-Za-z0-9]*)-?$/)
  if (teamKey) {
    return {
      or: [
        { team: { key: { eqIgnoreCase: teamKey[1] } } },
        { title: { containsIgnoreCase: term } },
      ],
    }
  }
  return { title: { containsIgnoreCase: term } }
}

// Linear's full-text search — matches across title, description, and comments
// with relevance ranking, over the WHOLE workspace (not just recent issues).
const ISSUES_SEARCH = `
  query($term: String!, $after: String) {
    searchIssues(term: $term, first: 50, after: $after) {
      nodes { id identifier title }
      pageInfo { hasNextPage endCursor }
    }
  }`

export type IssuePage = { issues: any[]; nextCursor: string | null }

// The picker's cursor carries the query mode it came from (`mode:cursor`) so
// page N+1 always continues the SAME query — otherwise an identifier term
// that fell through to full-text on page 1 would replay the strict filter
// with a foreign cursor on page 2.
function pageOf(conn: any, mode: string): IssuePage {
  const nodes = conn?.nodes || []
  const next = conn?.pageInfo?.hasNextPage ? conn.pageInfo.endCursor : null
  return { issues: nodes, nextCursor: next ? `${mode}:${next}` : null }
}

/**
 * Ticket-picker search (cursor-paginated, 50 per page).
 *  - empty term       → most recently updated issues
 *  - "WEB-656"/"WEB-" → deterministic identifier/team filter (full-text ranks
 *                       identifier lookups poorly); falls through to full-text
 *                       when the strict filter matches nothing
 *  - anything else    → Linear full-text search (title/description/comments),
 *                       with the title filter as fallback if the API errors
 */
export async function searchIssues(
  term: string,
  token: string | null,
  after: string | null = null,
): Promise<IssuePage> {
  if (!token) return { issues: [], nextCursor: null }
  const t = (term || '').trim()
  let mode: string | null = null
  let cursor: string | null = null
  if (after) {
    const sep = after.indexOf(':')
    if (sep > 0) {
      mode = after.slice(0, sep)
      cursor = after.slice(sep + 1)
    }
  }
  if (!mode) {
    mode = !t
      ? 'list'
      : /^[A-Za-z][A-Za-z0-9]*-?(\d+)?$/.test(t)
        ? 'filter'
        : 'search'
  }
  if (mode === 'list') {
    const data = await gql(ISSUES_LIST, token, { after: cursor })
    return pageOf(data.issues, 'list')
  }
  if (mode === 'filter') {
    const data = await gql(ISSUES_LIST, token, {
      filter: termToFilter(t),
      after: cursor,
    })
    const page = pageOf(data.issues, 'filter')
    // Empty first page → fall through to full-text; later pages return as-is.
    if (page.issues.length || cursor) return page
  }
  try {
    const data = await gql(ISSUES_SEARCH, token, { term: t, after: cursor })
    return pageOf(data.searchIssues, 'search')
  } catch (e) {
    console.warn(
      '[linear] full-text search failed, falling back to title filter:',
      (e as Error).message,
    )
    const data = await gql(ISSUES_LIST, token, { filter: termToFilter(t) })
    return pageOf(data.issues, 'filter')
  }
}

function buildBody(
  comment: Comment,
  media: { before?: string | null; after?: string | null } = {},
): string {
  const inspect = comment.inspect || null
  const component =
    inspect?.componentPath || inspect?.tag || comment.anchor?.label || null
  const lines = [comment.body, '', '---', '', '### DQA context', '']
  lines.push(`| | |`)
  lines.push(`|---|---|`)
  lines.push(`| Reviewer | ${comment.author} |`)
  lines.push(`| Page | ${comment.url} |`)
  if (component) lines.push(`| Component | \`${component}\` |`)
  lines.push(`| Element | \`${comment.anchor?.selector ?? 'n/a'}\` |`)
  if (inspect?.viewport) lines.push(`| Viewport | ${inspect.viewport} |`)
  if (inspect?.text) lines.push(`| Text | ${inspect.text} |`)
  if (inspect?.classes?.length) {
    lines.push('', '**Classes**', '', '```', inspect.classes.join(' '), '```')
  }
  if (comment.styleEdits?.length) {
    lines.push('', '### Suggested style changes', '')
    lines.push(`| Property | Current | Suggested |`)
    lines.push(`|---|---|---|`)
    for (const edit of comment.styleEdits) {
      lines.push(`| \`${edit.prop}\` | ${edit.from} | **${edit.to}** |`)
    }
  } else if (inspect?.styles && Object.keys(inspect.styles).length) {
    // No suggestions — still include the key computed styles for context.
    const keep = [
      'font-size',
      'font-weight',
      'line-height',
      'color',
      'padding',
      'margin',
    ]
    const rows = keep
      .filter((k) => inspect.styles[k])
      .map((k) => `| \`${k}\` | ${inspect.styles[k]} |`)
    if (rows.length)
      lines.push(
        '',
        '**Computed styles**',
        '',
        '| Property | Value |',
        '|---|---|',
        ...rows,
      )
  }
  const before = media.before || null
  const after = media.after || null
  if (before && after) {
    lines.push(
      '',
      '**Current**',
      '',
      `![current](${before})`,
      '',
      '**Suggested**',
      '',
      `![suggested](${after})`,
    )
  } else if (before) {
    lines.push('', `![screenshot](${before})`)
  }
  return lines.join('\n')
}

async function gql(
  query: string,
  token: string,
  variables?: Record<string, unknown>,
): Promise<any> {
  const res = await fetch(LINEAR_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(LINEAR_FETCH_TIMEOUT_MS),
  })
  const json = (await res.json()) as { data?: any; errors?: unknown }
  if (json.errors)
    throw new Error('Linear API error: ' + JSON.stringify(json.errors))
  return json.data
}

/**
 * Check whether a pushed comment/issue still exists in Linear.
 * Returns "ok", "deleted", or "unknown" (network/auth trouble — don't flag).
 */
export async function checkLinearStatus(
  linearRef: LinearRef | null,
  token: string | null,
): Promise<'ok' | 'deleted' | 'unknown'> {
  if (!token || !linearRef) return 'unknown'
  try {
    if (linearRef.commentId) {
      const data = await gql(
        `query($id: String!){ comment(id: $id){ id } }`,
        token,
        { id: linearRef.commentId },
      )
      return data.comment?.id ? 'ok' : 'deleted'
    }
    if (linearRef.issueId || linearRef.id) {
      const data = await gql(
        `query($id: String!){ issue(id: $id){ id trashed } }`,
        token,
        { id: linearRef.issueId || linearRef.id },
      )
      if (!data.issue?.id) return 'deleted'
      return data.issue.trashed ? 'deleted' : 'ok'
    }
    return 'unknown'
  } catch (e) {
    // Linear answers "Entity not found" as a GraphQL error for deleted ids.
    if (/not found|could not find/i.test((e as Error).message)) return 'deleted'
    return 'unknown'
  }
}

/**
 * Push a DQA reply to Linear as a THREADED reply under the comment we created
 * at push time (`parentId`), or as a plain issue comment when the DQA comment
 * was pushed as an issue/sub-issue. Replies are conversation text only — the
 * rich context (screenshot, selector, edits) already lives on the parent.
 * Best-effort: returns false instead of throwing (reply already saved in DQA).
 */
export async function pushReplyToLinear(
  linear: LinearRef,
  body: string,
  userToken: string | null,
): Promise<boolean> {
  if (!userToken) return false // dev sessions / no Linear identity
  try {
    const input: Record<string, unknown> = { body }
    if (linear.id) input.issueId = linear.id
    if (linear.commentId) input.parentId = linear.commentId
    if (!input.issueId && !input.parentId) return false
    const data = await gql(COMMENT_CREATE, userToken, { input })
    return !!data?.commentCreate?.success
  } catch (e) {
    console.warn('[linear] reply push failed:', (e as Error).message)
    return false
  }
}

// The signed-in reviewer's Linear user id (actor=user tokens only).
async function viewerId(token: string): Promise<string | null> {
  try {
    const data = await gql(`query { viewer { id } }`, token)
    return data.viewer?.id || null
  } catch {
    return null
  }
}

// "ENG-123" → { key: "ENG", number: 123 }
function parseIdentifier(
  ref: string | null | undefined,
): { key: string; number: number } | null {
  const m = String(ref || '')
    .trim()
    .match(/^([A-Za-z][A-Za-z0-9]*)-(\d+)$/)
  return m ? { key: m[1].toUpperCase(), number: Number(m[2]) } : null
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Accept either a team UUID or the short team key (e.g. "EDA") and resolve to the UUID.
async function resolveTeamId(
  ref: string,
  token: string,
): Promise<string | null> {
  if (UUID_RE.test(ref)) return ref
  const data = await gql(
    `query($key:String!){ teams(filter:{ key:{ eq:$key } }, first:1){ nodes { id } } }`,
    token,
    { key: String(ref).toUpperCase() },
  )
  return data.teams?.nodes?.[0]?.id || null
}

async function resolveIssueId(ref: string, token: string): Promise<any> {
  const parsed = parseIdentifier(ref)
  if (!parsed) return null
  const data = await gql(ISSUE_BY_KEY_NUMBER, token, parsed)
  return data.issues?.nodes?.[0] || null
}

/**
 * Push a DQA comment to Linear.
 * @param comment   the stored comment (may carry comment.issueRef like "ENG-123")
 * @param userToken the reviewer's Linear OAuth token (preferred), or null
 * @param baseUrl   service base url, to absolutize the screenshot link
 */
type PushOpts = {
  userToken?: string | null
  baseUrl?: string
  action?: LinearPushMode | null
  priority?: number | null
}
export async function pushToLinear(
  comment: Comment & { issueRef: string | null },
  { userToken, baseUrl, action, priority }: PushOpts = {},
): Promise<any> {
  const appKey = process.env.LINEAR_API_KEY
  const token = userToken || appKey
  const dryRun =
    !token || (!userToken && (process.env.LINEAR_DRY_RUN ?? 'true') !== 'false')
  // Screenshots: upload to Linear's file storage so they render regardless of
  // where the DQA server runs (skipped in dry-run — no token to upload with).
  const media = dryRun
    ? { before: comment.imageUrl, after: comment.afterImageUrl }
    : {
        before: await resolveMediaUrl(token, comment.imageUrl, baseUrl),
        after: await resolveMediaUrl(token, comment.afterImageUrl, baseUrl),
      }
  const body = buildBody(comment, media)
  // Resolve the requested action: comment on the ticket (default), create a
  // sub-issue under it, or create a standalone issue (lands in Triage when
  // the team has triage enabled).
  const mode = action || (comment.issueRef ? 'comment' : 'issue')

  // ---- DRY RUN (dev / no real token) ----
  if (dryRun) {
    console.log(
      `[linear] DRY RUN — would create ${mode}${comment.issueRef ? ` (ref ${comment.issueRef})` : ''}`,
    )
    return {
      dryRun: true,
      mode,
      issue: {
        identifier: comment.issueRef || 'DQA-DRYRUN',
        url: 'https://linear.app/ (dry run — sign in with Linear or set LINEAR_DRY_RUN=false)',
        title: comment.body.slice(0, 70),
      },
    }
  }

  const issueTitle = `[DQA] ${(comment.inspect?.componentPath || comment.anchor?.label || '').split(' › ').pop() || 'review'}: ${comment.body.slice(0, 60)}`

  // ---- comment onto the mapped/chosen ticket ----
  if (mode === 'comment') {
    if (!comment.issueRef) throw new Error('No target ticket for comment.')
    const issue = await resolveIssueId(comment.issueRef, token)
    if (!issue)
      throw new Error(`Could not find Linear issue ${comment.issueRef}`)
    const data = await gql(COMMENT_CREATE, token, {
      input: { issueId: issue.id, body },
    })
    if (!data.commentCreate?.success) throw new Error('commentCreate failed')
    return {
      dryRun: false,
      mode,
      issue: {
        ...issue,
        url: data.commentCreate.comment.url || issue.url,
        // Stored so we can later detect the comment being deleted in Linear.
        commentId: data.commentCreate.comment.id,
      },
    }
  }

  // Auto-assign created issues to the reviewer (their own OAuth token), so
  // DQA findings land on the person who reported them.
  const assigneeId = userToken ? await viewerId(token) : null

  // ---- sub-issue under the chosen ticket ----
  if (mode === 'subissue') {
    if (!comment.issueRef) throw new Error('No parent ticket for sub-issue.')
    const parent = await resolveIssueId(comment.issueRef, token)
    if (!parent)
      throw new Error(`Could not find Linear issue ${comment.issueRef}`)
    const input: Record<string, unknown> = {
      teamId: parent.team.id,
      parentId: parent.id,
      title: issueTitle,
      description: body,
    }
    if (priority != null) input.priority = priority
    if (assigneeId) input.assigneeId = assigneeId
    if (process.env.LINEAR_LABEL_ID)
      input.labelIds = [process.env.LINEAR_LABEL_ID]
    const data = await gql(ISSUE_CREATE, token, { input })
    if (!data.issueCreate?.success) throw new Error('issueCreate failed')
    return { dryRun: false, mode, issue: data.issueCreate.issue }
  }

  // ---- standalone issue (team triage) ----
  // Team: env LINEAR_TEAM_ID, else the team of the page's mapped ticket.
  let teamId = null
  if (process.env.LINEAR_TEAM_ID)
    teamId = await resolveTeamId(process.env.LINEAR_TEAM_ID, token)
  if (!teamId && comment.issueRef) {
    const ref = await resolveIssueId(comment.issueRef, token)
    teamId = ref?.team?.id || null
  }
  if (!teamId)
    throw new Error(
      'Set LINEAR_TEAM_ID (or map a page ticket) for issue creation.',
    )
  const input: Record<string, unknown> = {
    teamId,
    title: issueTitle,
    description: body,
  }
  if (priority != null) input.priority = priority
  if (assigneeId) input.assigneeId = assigneeId
  if (process.env.LINEAR_LABEL_ID)
    input.labelIds = [process.env.LINEAR_LABEL_ID]
  const data = await gql(ISSUE_CREATE, token, { input })
  if (!data.issueCreate?.success) throw new Error('issueCreate failed')
  return { dryRun: false, mode, issue: data.issueCreate.issue }
}
