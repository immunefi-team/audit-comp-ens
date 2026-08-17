/**
 * PR reminder bot — posts a Slack digest of open PRs that need attention:
 *
 *   1. waiting on a first review for longer than the configured threshold
 *   2. approved but missing the QA label
 *   3. carrying merge conflicts
 *
 * Runs from .github/workflows/pr-reminders.yml on a cron (the "2-3x a week"
 * knob lives there); config knobs live in .github/pr-reminders.json.
 *
 * Zero dependencies: GitHub GraphQL via fetch with GITHUB_TOKEN, Slack via an
 * incoming webhook (SLACK_WEBHOOK_URL). Set DRY_RUN=1 to print the message
 * instead of posting it.
 */

import { readFile } from 'node:fs/promises'

const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? 'ensdomains/apps-monorepo').split('/')
const token = process.env.GITHUB_TOKEN
const webhookUrl = process.env.SLACK_WEBHOOK_URL
const dryRun = process.env.DRY_RUN === '1'

if (!token) throw new Error('GITHUB_TOKEN is required')
if (!webhookUrl && !dryRun) throw new Error('SLACK_WEBHOOK_URL is required (or set DRY_RUN=1)')

const config = JSON.parse(
  await readFile(new URL('../pr-reminders.json', import.meta.url), 'utf8'),
)

const QUERY = `
  query ($owner: String!, $repo: String!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      pullRequests(states: OPEN, first: 50, after: $cursor, orderBy: { field: CREATED_AT, direction: ASC }) {
        pageInfo { hasNextPage endCursor }
        nodes {
          number
          title
          url
          isDraft
          createdAt
          mergeable
          reviewDecision
          author { login }
          labels(first: 20) { nodes { name } }
          reviews(first: 1) { totalCount }
          reviewRequests(first: 10) {
            nodes { requestedReviewer { ... on User { login } } }
          }
        }
      }
    }
  }
`

const fetchOpenPrs = async () => {
  const prs = []
  let cursor = null
  for (;;) {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { authorization: `bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ query: QUERY, variables: { owner, repo, cursor } }),
    })
    const { data, errors } = await res.json()
    if (errors) throw new Error(`GitHub GraphQL: ${JSON.stringify(errors)}`)
    const page = data.repository.pullRequests
    prs.push(...page.nodes)
    if (!page.pageInfo.hasNextPage) return prs
    cursor = page.pageInfo.endCursor
  }
}

// The first fetch may return mergeable: UNKNOWN while GitHub computes it in
// the background; one delayed retry settles almost all of them.
let prs = await fetchOpenPrs()
if (prs.some((pr) => pr.mergeable === 'UNKNOWN')) {
  await new Promise((resolve) => setTimeout(resolve, 15_000))
  prs = await fetchOpenPrs()
}

const hoursSince = (iso) => (Date.now() - new Date(iso).getTime()) / 36e5

const isIgnored = (pr) =>
  pr.isDraft ||
  config.ignoreAuthors.includes(pr.author?.login ?? '') ||
  pr.labels.nodes.some((l) => config.ignoreLabels.includes(l.name)) ||
  // "DO NOT MERGE" et al. often live in the title rather than as a label.
  config.ignoreTitlePatterns.some((pattern) =>
    pr.title.toUpperCase().includes(pattern.toUpperCase()),
  )

const candidates = prs.filter((pr) => !isIgnored(pr))

const needsReview = candidates.filter(
  (pr) =>
    pr.reviewDecision !== 'APPROVED' &&
    pr.reviewDecision !== 'CHANGES_REQUESTED' &&
    pr.reviews.totalCount === 0 &&
    hoursSince(pr.createdAt) >= config.minAgeHoursForReviewNag,
)

const needsQaLabel = candidates.filter(
  (pr) =>
    pr.reviewDecision === 'APPROVED' &&
    !pr.labels.nodes.some((l) => l.name === config.qaLabel),
)

const hasConflicts = candidates.filter((pr) => pr.mergeable === 'CONFLICTING')

// GitHub login -> Slack mention when mapped, plain @handle otherwise (a bare
// @handle deliberately doesn't ping anyone on Slack).
const mention = (login) => {
  const id = config.slackUserMap[login]
  return id && !id.startsWith('REPLACE') ? `<@${id}>` : `@${login}`
}

// PR titles are contributor-controlled; escape Slack's control characters so
// a title containing e.g. <!channel> can't trigger notifications from the bot.
const escapeSlack = (s) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const prLine = (pr, who) =>
  `• <${pr.url}|#${pr.number}> ${escapeSlack(pr.title.slice(0, 80))} — ${who}`

const sections = []
if (needsReview.length > 0)
  sections.push({
    heading: `:eyes: Waiting on a first review (>${config.minAgeHoursForReviewNag}h)`,
    lines: needsReview.map((pr) => {
      const reviewers = pr.reviewRequests.nodes
        .map((r) => r.requestedReviewer?.login)
        .filter(Boolean)
        .map(mention)
      const who =
        reviewers.length > 0
          ? `${reviewers.join(' ')} please review`
          : `${mention(pr.author.login)} please request a reviewer`
      return prLine(pr, who)
    }),
  })
if (needsQaLabel.length > 0) {
  // Tag the QA crew once per digest (on the heading), not on every line.
  const qaCrew = (config.qaEngineers ?? []).map(mention).join(' ')
  sections.push({
    heading: `:white_check_mark: Approved but missing "${config.qaLabel}"${qaCrew ? ` — cc ${qaCrew}` : ''}`,
    lines: needsQaLabel.map((pr) =>
      prLine(pr, `${mention(pr.author.login)} add the label / hand over to QA`),
    ),
  })
}
if (hasConflicts.length > 0)
  sections.push({
    heading: ':boom: Merge conflicts',
    lines: hasConflicts.map((pr) =>
      prLine(pr, `${mention(pr.author.login)} please rebase`),
    ),
  })

if (sections.length === 0) {
  console.log('Nothing to nag about — no message sent.')
  process.exit(0)
}

const text = [
  `*PR reminders for ${owner}/${repo}*`,
  ...sections.flatMap((s) => ['', `*${s.heading}*`, ...s.lines]),
].join('\n')

if (dryRun) {
  console.log('--- DRY RUN, would post to Slack: ---')
  console.log(text)
  process.exit(0)
}

const res = await fetch(webhookUrl, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ text, unfurl_links: false }),
})
if (!res.ok) throw new Error(`Slack webhook failed: ${res.status} ${await res.text()}`)
console.log(`Posted reminders: ${sections.map((s) => s.lines.length).join('/')} item(s).`)
