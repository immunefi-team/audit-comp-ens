import { staticTextRecords, textRecords } from '@/features/profile/data/records'
import type { LinkItem } from '@/features/profile/types'
import { isSafeHttpUrl } from '@/features/profile/utils/safeUrl'

export type LinkValidationField = 'name' | 'url'

export interface LinkValidationIssue {
  readonly field: LinkValidationField
  readonly index: number
  readonly message: string
}

const reservedTextRecordKeys = new Set<string>([
  ...staticTextRecords,
  ...textRecords.map((record) => record.key),
])

export const isReservedTextRecordKey = (name: string) =>
  reservedTextRecordKeys.has(name.trim())

const isEmptyLink = (link: LinkItem) =>
  link.name.trim() === '' && link.url.trim() === ''

export const getLinkValidationIssues = (
  links: readonly LinkItem[],
): LinkValidationIssue[] =>
  links.flatMap((link, index) => {
    const issues: LinkValidationIssue[] = []

    if (isEmptyLink(link)) {
      return issues
    }

    if (link.name.trim() === '') {
      issues.push({ field: 'name', index, message: 'Enter a title' })
    } else if (isReservedTextRecordKey(link.name)) {
      issues.push({
        field: 'name',
        index,
        message: 'Choose a different name (reserved key)',
      })
    }

    if (link.url.trim() === '') {
      issues.push({ field: 'url', index, message: 'Enter a link' })
    } else if (!isSafeHttpUrl(link.url)) {
      issues.push({ field: 'url', index, message: 'Enter a valid URL' })
    }

    return issues
  })
