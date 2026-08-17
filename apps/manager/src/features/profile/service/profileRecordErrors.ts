export type RecordIssue = {
  sectionKey: string
  fieldKey: string
  message: string
}

export class RecordsValidationError extends Error {
  issues: RecordIssue[]

  constructor(issues: RecordIssue[]) {
    super(issues.map((issue) => issue.message).join('\n'))
    this.name = 'RecordsValidationError'
    this.issues = issues
  }
}

const recordIssueTabLabels: Record<string, string> = {
  address: 'Addresses',
  addresses: 'Addresses',
  base: 'General',
  bio: 'General',
  contact: 'Contact',
  links: 'Links',
  social: 'Contact',
}

const toSentence = (message: string): string => {
  const trimmed = message.trim()
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

export const getRecordIssueTabLabel = (issue: RecordIssue) =>
  recordIssueTabLabels[issue.sectionKey]

export const getRecordIssueErrorMessage = (issue: RecordIssue) => {
  const tabLabel = getRecordIssueTabLabel(issue)

  return tabLabel
    ? `${toSentence(issue.message)} Go to ${tabLabel} to fix.`
    : issue.message
}

export const getRecordsValidationErrorMessage = (
  error: RecordsValidationError,
) => error.issues.map(getRecordIssueErrorMessage).join('\n')

export const getSaveRecordsErrorMessage = (error: unknown) => {
  if (!error || error instanceof RecordsValidationError) {
    return undefined
  }

  return error instanceof Error ? error.message : String(error)
}
