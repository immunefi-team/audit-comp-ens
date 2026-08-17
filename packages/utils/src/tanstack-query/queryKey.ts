export type GenericQueryKey = readonly [string, Record<string, unknown>?]

export type QueryKey<
  TKey extends string,
  TVariables = void,
> = TVariables extends void ? readonly [TKey] : readonly [TKey, TVariables]

/**
 * Creates a type-safe query key factory that can be used with or without variables
 * @template TKey The string literal type for the query key
 * @template TVariables Optional variables type. If not provided, the factory will not accept variables
 * @param key The query key string
 * @returns A function that creates a query key tuple
 *
 * @example Without variables:
 * ```typescript
 * const userKey = createQueryKey("user");
 * const key = userKey(); // returns ["user"]
 * ```
 *
 * @example With variables:
 * ```typescript
 * type UserVars = { id: string };
 * const userKey = createQueryKey<"user", UserVars>("user");
 * const key = userKey({ id: "123" }); // returns ["user", { id: "123" }]
 * ```
 */
export function createQueryKey<TKey extends string, TVariables = void>(
  key: TKey,
) {
  return ((variables?: TVariables) =>
    variables === undefined
      ? ([key] as const)
      : ([key, variables] as const)) as TVariables extends void
    ? () => QueryKey<TKey>
    : (variables: TVariables) => QueryKey<TKey, TVariables>
}

export function qk<const TScope, const TAction>(
  scope: TScope,
  action: TAction,
): [
  {
    $scope: TScope
    $action: TAction
  },
]
export function qk<
  const TScope,
  const TAction,
  const TVariables extends Record<string, unknown>,
>(
  scope: TScope,
  action: TAction,
  variables: TVariables,
): [
  {
    $scope: TScope
    $action: TAction
  } & TVariables,
]
export function qk(
  scope: unknown,
  action: unknown,
  variables?: unknown,
): [
  {
    $scope: unknown
    $action: unknown
  } & unknown,
] {
  return [
    {
      $scope: scope,
      $action: action,
      ...(variables ?? {}),
    },
  ]
}

export function $qk<
  const T extends {
    $scope?: string
    $action?: string
    $service?: string
  } & Record<string, unknown>,
>(qk: T) {
  return [qk]
}
