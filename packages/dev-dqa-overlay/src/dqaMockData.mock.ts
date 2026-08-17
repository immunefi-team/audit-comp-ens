import { DQA_LINEAR_ISSUE } from './config'
import type { DqaCommentSummary, DqaState, DqaUser } from './types'

const hoursAgo = (hours: number) =>
  new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

export const mockUser: DqaUser = {
  id: 'mock-you',
  name: 'Alex Chen',
  color: '#0080bc',
}

export const mockPresence: readonly DqaUser[] = [
  { id: 'mock-1', name: 'Sam Rivera', color: '#093c52' },
  { id: 'mock-2', name: 'Jordan Lee', color: '#0070a4' },
  { id: 'mock-3', name: 'Morgan Kim', color: '#5c8a9a' },
  { id: 'mock-4', name: 'Taylor Park', color: '#b42013' },
  { id: 'mock-5', name: 'Casey Wu', color: '#737373' },
  { id: 'mock-6', name: 'Riley Fox', color: '#0080bc' },
]

export const mockComments: readonly DqaCommentSummary[] = [
  {
    id: 'mock-c1',
    pinIndex: 1,
    body: 'Spacing feels tight on mobile — button label wraps awkwardly.',
    author: 'Alex Chen',
    status: 'open',
    anchorLabel: 'Register name button',
    replyCount: 2,
    createdAt: hoursAgo(2),
    issueRef: 'WEB-495',
    linear: {
      identifier: 'WEB-495',
      url: 'https://linear.app/ens/issue/WEB-495',
    },
  },
  {
    id: 'mock-c2',
    pinIndex: 2,
    body: "Border color doesn't match the spec — should be accentDense (#093c52).",
    author: 'Sam Rivera',
    status: 'resolved',
    anchorLabel: 'NameRow · avatar',
    replyCount: 0,
    createdAt: hoursAgo(5),
    issueRef: 'WEB-512',
    linear: {
      identifier: 'WEB-512',
      url: 'https://linear.app/ens/issue/WEB-512',
    },
  },
  {
    id: 'mock-c3',
    pinIndex: 3,
    body: 'Chart tooltip overlaps the legend on narrow viewports.',
    author: 'Jordan Lee',
    status: 'open',
    anchorLabel: 'Pricing chart',
    replyCount: 1,
    createdAt: hoursAgo(8),
    issueRef: null,
    linear: null,
  },
  {
    id: 'mock-c4',
    pinIndex: 4,
    body: 'Copy should say "Register name" not "Buy name" per WEB-495.',
    author: 'Morgan Kim',
    status: 'open',
    anchorLabel: 'TokenPicker · confirm CTA',
    replyCount: 0,
    createdAt: hoursAgo(1),
    issueRef: 'WEB-495',
    linear: {
      identifier: 'WEB-495',
      url: 'https://linear.app/ens/issue/WEB-495',
    },
  },
  {
    id: 'mock-c5',
    pinIndex: 5,
    body: 'DevDrawer tab accent dot should match tab color when active.',
    author: 'Taylor Park',
    status: 'resolved',
    anchorLabel: 'DevDrawer · Design QA tab',
    replyCount: 3,
    createdAt: hoursAgo(24),
    issueRef: null,
    linear: null,
  },
]

export const mockOpenCount = mockComments.filter(
  (c) => c.status !== 'resolved',
).length

export const mockPageIssueRef = DQA_LINEAR_ISSUE ?? 'WEB-495'

export const createMockPreviewState = (
  overrides?: Partial<DqaState>,
): DqaState => ({
  ready: true,
  loading: false,
  authenticated: false,
  user: null,
  commentMode: false,
  openCount: mockOpenCount,
  presence: mockPresence.slice(0, 3),
  authConfig: { oauthConfigured: true, devAllowed: true },
  signInError: null,
  comments: mockComments,
  activeCommentId: null,
  pageIssueRef: mockPageIssueRef,
  ...overrides,
})

export const createMockAuthenticatedState = (
  overrides?: Partial<DqaState>,
): DqaState =>
  createMockPreviewState({
    authenticated: true,
    user: mockUser,
    presence: mockPresence,
    ...overrides,
  })
