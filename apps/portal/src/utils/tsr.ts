import type {
  AnyRouter,
  RegisteredRouter,
  ValidateLinkOptions,
} from '@tanstack/react-router'

type DefineLinkItemFn<T, TComp = 'a'> = <
  const TOptions,
  TRouter extends AnyRouter = RegisteredRouter,
>(
  options: T & { link: ValidateLinkOptions<TRouter, TOptions, string, TComp> },
) => T & { link: TOptions }

/**
 * Type helper that works similar to linkOptions but allows for partial const type checking of the link options while keeping the other properties as the original type.
 *
 * @example
 * ```typescript
 * type SidebarItem = {
 *   title: string
 *   disabled?: boolean
 *   upcoming?: boolean
 * }
 *
 * const defineSidebarItem = createDefineLinkItem<SidebarItem>()
 *
 * const sidebarItem1 = defineSidebarItem({
 *   title: 'Test',
 *   link: {
 *     to: '/$name',
 *     params: { name: 'test' },
 *   },
 * })
 *
 * // sidebarItem1['title] is string while sidebarItem1['link'] is a validated const type of the link options.
 * ```
 */
export const createDefineLinkItem =
  <T, TComp = 'a'>(): DefineLinkItemFn<Omit<T, 'link'>, TComp> =>
  (props) =>
    // biome-ignore lint/suspicious/noExplicitAny: Necessary to optimize type checking
    props as any
