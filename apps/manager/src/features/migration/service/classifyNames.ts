import type { ClassifiedName } from '@ens-apps/migration'

export {
  type ClassifiedName,
  classifyName,
  classifyNames,
  FUSES,
  hasFuse,
  type IneligibleName,
  type MigrationTokenType,
} from '@ens-apps/migration'

export const is2LD = (name: ClassifiedName): boolean =>
  name.tokenType === 'unwrapped' ||
  name.tokenType === 'unlocked' ||
  name.tokenType === 'locked-2ld'

export type GroupedNames = {
  readonly unwrapped: readonly ClassifiedName[]
  readonly unlocked: readonly ClassifiedName[]
  readonly locked2ld: readonly ClassifiedName[]
  readonly childNames: ReadonlyMap<string, readonly ClassifiedName[]>
}

export const groupClassifiedNames = (names: ClassifiedName[]): GroupedNames => {
  const unwrapped: ClassifiedName[] = []
  const unlocked: ClassifiedName[] = []
  const locked2ld: ClassifiedName[] = []
  const childNames = new Map<string, ClassifiedName[]>()

  for (const name of names) {
    switch (name.tokenType) {
      case 'unwrapped':
        unwrapped.push(name)
        break
      case 'unlocked':
        unlocked.push(name)
        break
      case 'locked-2ld':
        locked2ld.push(name)
        break
      case 'locked-child':
      case 'detached-child': {
        const parent = name.parentName
        if (!parent) break
        const existing = childNames.get(parent) ?? []
        existing.push(name)
        childNames.set(parent, existing)
        break
      }
    }
  }

  return { unwrapped, unlocked, locked2ld, childNames }
}
