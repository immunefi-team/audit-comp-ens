import { Trans } from '@lingui/react/macro'
import { match } from 'ts-pattern'
import type { useNameSelection } from '@/features/migration/hooks/useNameSelection'
import { NameListSkeleton } from './NameListSkeleton'
import { NameRow } from './NameRow'

type NameSelectionState = ReturnType<typeof useNameSelection>

type SelectNamesStepNameListProps = Pick<
  NameSelectionState,
  | 'filteredGroups'
  | 'filteredOrphans'
  | 'search'
  | 'selected'
  | 'toggleGroup'
  | 'toggleName'
> & {
  readonly isPending: boolean
}

export const SelectNamesStepNameList = ({
  filteredGroups,
  filteredOrphans,
  isPending,
  search,
  selected,
  toggleGroup,
  toggleName,
}: SelectNamesStepNameListProps) =>
  match({
    isPending,
    hasResults: filteredGroups.length > 0 || filteredOrphans.length > 0,
  })
    .with({ isPending: true }, () => <NameListSkeleton />)
    .with({ hasResults: false }, () => (
      <div className="flex flex-col items-center gap-3 py-8">
        <p className="text-ens-garnet-900/40 text-sm">
          {match(search)
            .when(
              (s) => s.length > 0,
              () => <Trans>No names match your search</Trans>,
            )
            .otherwise(() => (
              <Trans>No eligible names found for this wallet</Trans>
            ))}
        </p>
      </div>
    ))
    .otherwise(() => [
      ...filteredGroups.flatMap((group) => {
        const parentName = group.parent.domain.name
        const parentSelected = selected.has(parentName)
        const subnameNames = group.subnames.map((s) => s.domain.name)
        return [
          <NameRow
            indent={false}
            interactive={true}
            isSelected={parentSelected}
            item={group.parent}
            key={group.parent.domain.id}
            onClick={() => toggleGroup(parentName, subnameNames)}
          />,
          ...group.subnames.map((sub, idx) => (
            <NameRow
              firstSubname={idx === 0}
              indent={true}
              interactive={false}
              isSelected={parentSelected}
              item={sub}
              key={sub.domain.id}
            />
          )),
        ]
      }),
      ...filteredOrphans.map((orphan) => (
        <NameRow
          indent={false}
          interactive={true}
          isSelected={selected.has(orphan.domain.name)}
          item={orphan}
          key={orphan.domain.id}
          onClick={() => toggleName(orphan.domain.name)}
        />
      )),
    ])
