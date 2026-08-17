// Dead-simple JSON-file store. Zero native deps so `pnpm install` never fails on a
// teammate's machine. Swap for Postgres/SQLite when this graduates past v0.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Comment, Reply } from './types.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = resolve(__dirname, '../data')
const DB_FILE = resolve(DATA_DIR, 'comments.json')

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })

let state: { comments: Comment[] } = { comments: [] }
if (existsSync(DB_FILE)) {
  try {
    state = JSON.parse(readFileSync(DB_FILE, 'utf8'))
  } catch {
    state = { comments: [] }
  }
}

function persist(): void {
  writeFileSync(DB_FILE, JSON.stringify(state, null, 2))
}

export function listComments(url?: string): Comment[] {
  if (!url) return state.comments
  return state.comments.filter((c) => c.url === url)
}

export function addComment(comment: Comment): Comment {
  state = { comments: [...state.comments, comment] }
  persist()
  return comment
}

export function addReply(commentId: string, reply: Reply): Comment | null {
  const existing = state.comments.find((x) => x.id === commentId)
  if (!existing) return null
  const updated: Comment = {
    ...existing,
    replies: [...(existing.replies ?? []), reply],
  }
  state = {
    comments: state.comments.map((c) => (c.id === commentId ? updated : c)),
  }
  persist()
  return updated
}

export function updateComment(
  commentId: string,
  patch: Partial<Comment>,
): Comment | null {
  const existing = state.comments.find((x) => x.id === commentId)
  if (!existing) return null
  const updated: Comment = { ...existing, ...patch }
  state = {
    comments: state.comments.map((c) => (c.id === commentId ? updated : c)),
  }
  persist()
  return updated
}

export function removeComment(commentId: string): Comment | null {
  const existing = state.comments.find((x) => x.id === commentId)
  if (!existing) return null
  state = { comments: state.comments.filter((c) => c.id !== commentId) }
  persist()
  return existing
}
