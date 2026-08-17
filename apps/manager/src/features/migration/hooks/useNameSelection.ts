import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  collectAllSelectable,
  countVisibleRows,
  filterGroupsBySearch,
  filterOrphansBySearch,
  toggleGroup as toggleGroupPure,
  toggleName as toggleNamePure,
} from '../components/selectNames.helpers'
import type { ClassifiedName } from '../service/classifyNames'
import { groupByParent } from '../service/groupByParent'

type Params = {
  readonly eligible: readonly ClassifiedName[]
  readonly isPending: boolean
  readonly onNamesChange: (names: string[]) => void
}

export const useNameSelection = ({
  eligible,
  isPending,
  onNamesChange,
}: Params) => {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { groups, orphans } = useMemo(() => groupByParent(eligible), [eligible])
  const allSelectable = useMemo(
    () => collectAllSelectable(groups, orphans),
    [groups, orphans],
  )

  const didSeed = useRef(false)
  useEffect(() => {
    if (didSeed.current || isPending || eligible.length === 0) return
    didSeed.current = true
    setSelected(allSelectable)
    onNamesChange([...allSelectable])
  }, [isPending, eligible.length, allSelectable, onNamesChange])

  useEffect(() => {
    if (!didSeed.current || isPending) return
    setSelected((prev) => {
      const next = new Set([...prev].filter((name) => allSelectable.has(name)))
      if (next.size === prev.size) return prev
      onNamesChange([...next])
      return next
    })
  }, [allSelectable, isPending, onNamesChange])

  const searchLower = search.toLowerCase()
  const filteredGroups = useMemo(
    () => filterGroupsBySearch(groups, searchLower),
    [groups, searchLower],
  )
  const filteredOrphans = useMemo(
    () => filterOrphansBySearch(orphans, searchLower),
    [orphans, searchLower],
  )

  const toggleName = useCallback(
    (name: string) => {
      setSelected((prev) => {
        const next = toggleNamePure(prev, name)
        onNamesChange([...next])
        return next
      })
    },
    [onNamesChange],
  )

  const toggleGroup = useCallback(
    (parentName: string, subnameNames: readonly string[]) => {
      setSelected((prev) => {
        const next = toggleGroupPure(prev, parentName, subnameNames)
        onNamesChange([...next])
        return next
      })
    },
    [onNamesChange],
  )

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const isAllSelected =
        allSelectable.size > 0 &&
        [...allSelectable].every((name) => prev.has(name))
      const next = isAllSelected ? new Set<string>() : allSelectable
      onNamesChange([...next])
      return next
    })
  }, [allSelectable, onNamesChange])

  const allSelectableCount = countVisibleRows(groups, orphans)
  const currentSelected = useMemo(
    () => new Set([...selected].filter((name) => allSelectable.has(name))),
    [allSelectable, selected],
  )
  const allSelected =
    allSelectable.size > 0 &&
    [...allSelectable].every((name) => currentSelected.has(name))

  return {
    search,
    setSearch,
    selected: currentSelected,
    totalSelected: currentSelected.size,
    visibleCount: allSelectableCount,
    allSelected,
    filteredGroups,
    filteredOrphans,
    toggleName,
    toggleGroup,
    toggleAll,
  }
}
