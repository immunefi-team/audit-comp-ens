export type ResultError = { _tag: string }

export type NonUndefinedGuard<T> = T extends undefined ? never : T
