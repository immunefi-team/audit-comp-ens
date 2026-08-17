import { type ClassifiedName, is2LD } from './classifyNames'

export type NameGroup = {
  readonly parent: ClassifiedName
  readonly subnames: readonly ClassifiedName[]
}

export type GroupedForUi = {
  readonly groups: readonly NameGroup[]
  readonly orphans: readonly ClassifiedName[]
}

export const groupByParent = (
  eligible: readonly ClassifiedName[],
): GroupedForUi => {
  const byName = new Map<string, ClassifiedName>()
  for (const n of eligible) byName.set(n.domain.name, n)

  const subnamesByParent = new Map<string, ClassifiedName[]>()
  const roots: ClassifiedName[] = []
  const orphans: ClassifiedName[] = []

  for (const n of eligible) {
    if (is2LD(n)) {
      roots.push(n)
      continue
    }
    const parent = n.parentName
    const parentNode = parent ? byName.get(parent) : undefined
    if (!parent || !parentNode || !is2LD(parentNode)) {
      orphans.push(n)
      continue
    }
    const list = subnamesByParent.get(parent) ?? []
    list.push(n)
    subnamesByParent.set(parent, list)
  }

  roots.sort((a, b) => a.domain.name.localeCompare(b.domain.name))
  orphans.sort((a, b) => a.domain.name.localeCompare(b.domain.name))

  const groups = roots.map((parent) => {
    const subnames = (subnamesByParent.get(parent.domain.name) ?? [])
      .slice()
      .sort((a, b) => a.domain.name.localeCompare(b.domain.name))
    return { parent, subnames }
  })

  return { groups, orphans }
}
