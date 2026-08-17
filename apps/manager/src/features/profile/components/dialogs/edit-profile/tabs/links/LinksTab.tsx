import { Pencil, Plus, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { LinkItem, ProfileRecords } from '@/features/profile/types'
import { cn } from '@/lib/utils'
import { useEditProfileDialogStatus } from '../../EditProfileDialog.context'
import {
  getLinkValidationIssues,
  type LinkValidationField,
  type LinkValidationIssue,
} from './validation'

interface LinkRow {
  readonly index: number
  readonly isDraft: boolean
  readonly key: string
  readonly link: LinkItem
}

interface DraftLinkRow {
  readonly key: string
  readonly link: LinkItem
}

interface LinksTabProps {
  readonly onDraftValidationIssuesChange: (hasValidationIssues: boolean) => void
  readonly onLinksChange: (links: ProfileRecords['links']) => void
  readonly values: ProfileRecords
}

const defaultLink = (): LinkItem => ({
  name: '',
  url: '',
})

const hasRequiredLinkFields = (link: LinkItem) =>
  link.name.trim() !== '' && link.url.trim() !== ''

const getIssue = (
  issues: readonly LinkValidationIssue[],
  index: number,
  field: LinkValidationField,
) =>
  issues.find((issue) => issue.index === index && issue.field === field)
    ?.message

const getLinkRows = (
  links: readonly LinkItem[],
  linkRowKeys: readonly string[],
  draftRows: readonly DraftLinkRow[],
): LinkRow[] => [
  ...links.map((link, index) => ({
    index,
    isDraft: false,
    key: linkRowKeys[index] ?? `link-${index}`,
    link,
  })),
  ...draftRows.map((draftRow, draftIndex) => ({
    index: links.length + draftIndex,
    isDraft: true,
    key: draftRow.key,
    link: draftRow.link,
  })),
]

const updateLinkAtIndex = (
  links: readonly LinkItem[],
  index: number,
  value: Partial<LinkItem>,
) =>
  links.map((link, linkIndex) =>
    linkIndex === index ? { ...link, ...value } : link,
  )

export const LinksTab = ({
  onDraftValidationIssuesChange,
  onLinksChange,
  values,
}: LinksTabProps) => {
  const { isSaving } = useEditProfileDialogStatus()
  const nextRowKeyRef = useRef(0)
  const createRowKey = useCallback(() => {
    const rowKey = `link-row-${nextRowKeyRef.current}`
    nextRowKeyRef.current += 1
    return rowKey
  }, [])
  const createDraftRow = useCallback(
    (): DraftLinkRow => ({ key: createRowKey(), link: defaultLink() }),
    [createRowKey],
  )
  const [linkRowKeys, setLinkRowKeys] = useState(() =>
    values.links.map(() => createRowKey()),
  )
  const [draftRows, setDraftRows] = useState<DraftLinkRow[]>(() =>
    values.links.length === 0 ? [createDraftRow()] : [],
  )
  const validationIssues = getLinkValidationIssues(values.links)
  const draftValidationIssues = getLinkValidationIssues(
    draftRows.map(({ link }) => link),
  )
  const rows = getLinkRows(values.links, linkRowKeys, draftRows)
  const titleInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    if (values.links.length === 0) {
      setDraftRows((current) =>
        current.length === 0 ? [createDraftRow()] : current,
      )
    }
  }, [createDraftRow, values.links.length])

  useEffect(() => {
    onDraftValidationIssuesChange(draftValidationIssues.length > 0)
  }, [draftValidationIssues.length, onDraftValidationIssuesChange])

  useEffect(() => {
    setLinkRowKeys((current) => {
      if (current.length === values.links.length) {
        return current
      }

      if (current.length > values.links.length) {
        return current.slice(0, values.links.length)
      }

      return [
        ...current,
        ...Array.from(
          { length: values.links.length - current.length },
          createRowKey,
        ),
      ]
    })
  }, [createRowKey, values.links.length])

  const updateRow = (row: LinkRow, value: Partial<LinkItem>) => {
    if (row.isDraft) {
      const nextLink = { ...row.link, ...value }

      if (!hasRequiredLinkFields(nextLink)) {
        setDraftRows((current) =>
          current.map((draftRow) =>
            draftRow.key === row.key
              ? { ...draftRow, link: nextLink }
              : draftRow,
          ),
        )
        return
      }

      onLinksChange([...values.links, nextLink])
      setLinkRowKeys((current) => [...current, row.key])
      setDraftRows((current) =>
        current.filter((draftRow) => draftRow.key !== row.key),
      )
      return
    }

    const nextLinks = updateLinkAtIndex(values.links, row.index, value)
    onLinksChange(nextLinks)
  }

  const trimRowValue = (row: LinkRow, field: keyof LinkItem) => {
    updateRow(row, { [field]: row.link[field].trim() })
  }

  const removeLink = (index: number) => {
    onLinksChange(values.links.filter((_, linkIndex) => linkIndex !== index))
    setLinkRowKeys((current) =>
      current.filter((_, linkIndex) => linkIndex !== index),
    )
  }

  const removeDraftRow = (key: string) => {
    setDraftRows((current) =>
      current.filter((draftRow) => draftRow.key !== key),
    )
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex flex-col gap-1.5">
        <p className="font-bold font-sans text-[#525252] text-[16px] leading-[0.96] tracking-[-0.32px]">
          Links
        </p>
        <p className="text-[16px] text-ens-quartz-400 leading-[1.2]">
          Add links to your website, portfolio, or anything you want to share.
        </p>
      </div>

      <div className="flex flex-col gap-4 overflow-hidden">
        {rows.map((row) => {
          const rowIssueIndex = row.isDraft
            ? row.index - values.links.length
            : row.index
          const rowIssues = row.isDraft
            ? draftValidationIssues
            : validationIssues
          const nameError = getIssue(rowIssues, rowIssueIndex, 'name')
          const urlError = getIssue(rowIssues, rowIssueIndex, 'url')
          const rowKey = row.key

          return (
            <div className="flex flex-col gap-1" key={rowKey}>
              <div className="flex items-center gap-1 text-[14px]">
                <span className="relative inline-flex max-w-55 items-center overflow-hidden">
                  <span
                    aria-hidden
                    className="invisible h-5 whitespace-pre text-[14px] text-ens-quartz-500 leading-[0.96] tracking-[0.07px]"
                  >
                    {row.link.name || 'Link Title'}
                  </span>
                  <input
                    aria-invalid={Boolean(nameError)}
                    aria-label={`Link ${row.index + 1} title`}
                    className={cn(
                      'absolute inset-0 h-5 w-full min-w-0 bg-transparent p-0 text-[14px] text-ens-quartz-500 leading-[0.96] tracking-[0.07px] outline-none placeholder:text-ens-quartz-400 disabled:opacity-50',
                      nameError && 'text-destructive',
                    )}
                    disabled={isSaving}
                    onBlur={() => trimRowValue(row, 'name')}
                    onChange={(event) =>
                      updateRow(row, { name: event.target.value })
                    }
                    placeholder="Link Title"
                    ref={(element) => {
                      titleInputRefs.current[rowKey] = element
                    }}
                    value={row.link.name}
                  />
                </span>
                <button
                  aria-label={`Edit link ${row.index + 1} title`}
                  className="flex size-5 items-center justify-center rounded-sm text-ens-quartz-400 transition-colors hover:bg-ens-quartz-100 hover:text-ens-quartz-700 disabled:pointer-events-none disabled:opacity-50"
                  disabled={isSaving}
                  onClick={() => titleInputRefs.current[rowKey]?.focus()}
                  type="button"
                >
                  <Pencil className="size-3.5" />
                </button>
              </div>

              <div className="relative min-w-0 flex-1">
                <input
                  aria-invalid={Boolean(urlError)}
                  aria-label={`Link ${row.index + 1} URL`}
                  className={cn(
                    'h-11 w-full rounded-sm border border-[#d4d4d4] bg-transparent py-4 pr-10 pl-4 text-ens-quartz-900 text-xs outline-none transition-colors placeholder:text-ens-quartz-400 focus-visible:border-ens-lapis-500 disabled:pointer-events-none disabled:opacity-50',
                    urlError &&
                      'border-destructive focus-visible:border-destructive',
                  )}
                  disabled={isSaving}
                  onBlur={() => trimRowValue(row, 'url')}
                  onChange={(event) =>
                    updateRow(row, { url: event.target.value })
                  }
                  placeholder="https://your-link.com"
                  value={row.link.url}
                />

                <button
                  aria-label={`Remove link ${row.index + 1}`}
                  className="absolute top-1/2 right-3 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-ens-quartz-400 transition-colors hover:bg-ens-quartz-100 hover:text-ens-quartz-700 disabled:pointer-events-none disabled:opacity-50"
                  disabled={isSaving}
                  onClick={() =>
                    row.isDraft
                      ? removeDraftRow(row.key)
                      : removeLink(row.index)
                  }
                  type="button"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              {(nameError || urlError) && (
                <div className="flex flex-col gap-0.5 text-destructive text-xs">
                  {nameError && <p>{nameError}</p>}
                  {urlError && <p>{urlError}</p>}
                </div>
              )}
            </div>
          )
        })}

        <button
          className="flex h-6 min-w-0 items-center gap-2.75 rounded-[15px] p-1 text-[14px] text-ens-quartz-500 leading-[0.96] tracking-[0.07px] transition-colors hover:text-ens-quartz-700 disabled:pointer-events-none disabled:opacity-50 md:min-w-75"
          disabled={isSaving}
          onClick={() =>
            setDraftRows((current) => [...current, createDraftRow()])
          }
          type="button"
        >
          <Plus className="size-4" />
          Add more
        </button>
      </div>
    </div>
  )
}
