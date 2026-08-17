import { Trans, useLingui } from '@lingui/react/macro'
import { Check, Info, Search } from 'lucide-react'
import type { useNameSelection } from '@/features/migration/hooks/useNameSelection'
import { cn } from '@/lib/utils'
import { SelectNamesStepNameList } from './SelectNamesStepNameList'

type NameSelectionState = ReturnType<typeof useNameSelection>

type SelectedCountLabelProps = {
  readonly allSelected: boolean
  readonly totalSelected: number
  readonly visibleCount: number
}

const SelectedCountLabel = ({
  allSelected,
  totalSelected,
  visibleCount,
}: SelectedCountLabelProps) =>
  allSelected ? (
    <Trans>
      <span>All </span>
      <span>{visibleCount}</span>
      <span className="font-semi-mono uppercase"> eligible names selected</span>
    </Trans>
  ) : (
    <Trans>
      <span>{totalSelected}</span>
      <span> out of </span>
      <span>{visibleCount}</span>
      <span className="font-semi-mono uppercase"> eligible names selected</span>
    </Trans>
  )

type SelectNamesStepSelectionOptionsProps = Pick<
  NameSelectionState,
  | 'allSelected'
  | 'filteredGroups'
  | 'filteredOrphans'
  | 'search'
  | 'selected'
  | 'setSearch'
  | 'toggleAll'
  | 'toggleGroup'
  | 'toggleName'
  | 'totalSelected'
  | 'visibleCount'
> & {
  readonly isCompactLayout: boolean
  readonly isContentHeightCard: boolean
  readonly isPending: boolean
  readonly showBulkSelection: boolean
  readonly showNameSearch: boolean
}

export const SelectNamesStepSelectionOptions = ({
  allSelected,
  filteredGroups,
  filteredOrphans,
  isCompactLayout,
  isContentHeightCard,
  isPending,
  search,
  selected,
  setSearch,
  showBulkSelection,
  showNameSearch,
  toggleAll,
  toggleGroup,
  toggleName,
  totalSelected,
  visibleCount,
}: SelectNamesStepSelectionOptionsProps) => {
  const { t } = useLingui()

  return (
    <div
      className={cn(
        'flex min-h-0 w-full max-w-189 flex-1 flex-col gap-4',
        isContentHeightCard && 'md:flex-none',
      )}
    >
      {showNameSearch && (
        <div className="flex h-8 shrink-0 items-center gap-3.25 rounded-[30px] bg-white/80 px-[6.5px] py-1.5 md:h-10.5 md:gap-3 md:rounded-[20px] md:bg-white/40 md:px-4">
          <Search className="size-4 shrink-0 text-ens-garnet-900/40" />
          <input
            aria-label={t`Search names`}
            className="flex-1 bg-transparent text-ens-garnet-900 text-sm leading-[0.96] tracking-[-0.28px] placeholder:text-ens-garnet-900/40 focus:outline-none md:text-base md:tracking-[-0.32px]"
            disabled={isPending}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t`Search names`}
            type="text"
            value={search}
          />
        </div>
      )}

      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-hidden rounded-none bg-transparent p-0 md:rounded-[20px] md:border md:border-white md:bg-[rgba(254,234,240,0.72)]',
          isCompactLayout ? 'md:p-6' : 'md:p-12',
          isContentHeightCard && 'md:flex-none',
        )}
      >
        <div className="flex shrink-0 flex-col gap-2">
          <div className="flex items-center gap-2 text-ens-garnet-900 text-sm leading-[1.2] tracking-[0.14px] md:text-base md:tracking-[0.16px]">
            <Check className="size-5 shrink-0 md:hidden" strokeWidth={1.8} />
            <p>
              <SelectedCountLabel
                allSelected={allSelected}
                totalSelected={totalSelected}
                visibleCount={visibleCount}
              />
            </p>
          </div>
          <p className="flex items-start gap-1 text-ens-garnet-900/70 text-xs leading-normal tracking-[-0.24px] md:items-center md:text-sm md:leading-[0.96] md:tracking-[-0.28px]">
            <Info
              className="mt-0.5 size-3.5 shrink-0 md:mt-0"
              strokeWidth={1.8}
            />
            <Trans>
              Your names, text records, and addresses will migrate automatically
            </Trans>
          </p>
        </div>

        {showBulkSelection && (
          <button
            aria-pressed={allSelected}
            className="mt-4 flex shrink-0 items-center gap-2 self-start text-ens-garnet-900 text-sm leading-[1.2] tracking-[0.14px] md:mt-3 md:text-base md:tracking-[0.16px]"
            disabled={isPending}
            onClick={toggleAll}
            type="button"
          >
            <span
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full border border-ens-garnet-900 bg-transparent p-1 transition-colors',
                isPending && 'opacity-50',
              )}
            >
              <Check
                className="size-5 text-ens-garnet-900"
                strokeWidth={2.25}
              />
            </span>
            {allSelected ? (
              <Trans>Deselect all</Trans>
            ) : (
              <Trans>Select all</Trans>
            )}
          </button>
        )}

        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto pr-3 [scrollbar-color:#f2b9d0_rgba(250,249,247,0.45)] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#f2b9d0] [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-[rgba(250,249,247,0.45)] [&::-webkit-scrollbar]:w-2',
            isCompactLayout ? 'mt-4' : 'mt-8',
            isContentHeightCard && 'md:flex-none md:overflow-visible',
          )}
        >
          <div className="flex flex-col gap-4">
            <SelectNamesStepNameList
              filteredGroups={filteredGroups}
              filteredOrphans={filteredOrphans}
              isPending={isPending}
              search={search}
              selected={selected}
              toggleGroup={toggleGroup}
              toggleName={toggleName}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
