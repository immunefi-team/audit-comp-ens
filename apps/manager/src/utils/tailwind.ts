import clsx, { type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

const isTemplateStringsArray = (
  value: unknown,
): value is TemplateStringsArray => Array.isArray(value) && 'raw' in value

/**
 * Build Tailwind class strings using `clsx`, with optional tagged template syntax
 * so you can get Tailwind IntelliSense even when you are outside `class` / `className`.
 *
 * When used as a **tagged template**, you get nice DX + IntelliSense:
 *
 * @example Tagged template with IntelliSense
 * ```ts
 * const classes = tw`bg-red-500 hover:bg-red-600 ${isActive && 'opacity-100'}`
 * ```
 *
 * You can also call it like a normal `clsx` / `cn` helper:
 *
 * @example Function call form (clsx-compatible)
 * ```ts
 * const classes = tw(
 *   'bg-red-500',
 *   isActive && 'opacity-100',
 *   ['text-sm', extraClass],
 * )
 * ```
 *
 * Internally this wraps `clsx`, so you can pass strings, arrays, objects, conditionals,
 * and nested structures exactly like you would with `clsx`. The tagged-template mode just
 * zips the template pieces with your interpolations to preserve that behavior while
 * enabling Tailwind-aware editor hints.
 *
 * Prefer `tw` when you:
 * - Just want to build class strings and don’t need Tailwind conflict resolution.
 * - Want the cheapest helper in hot paths (no merge step).
 *
 * If you need Tailwind-aware conflict resolution (e.g. `bg-red-500` vs `bg-blue-500`,
 * `p-2` vs `p-4`, etc.), see {@link twm}.
 */
export const tw = (
  template: TemplateStringsArray | ClassValue,
  ...params: ClassValue[]
): string => {
  if (isTemplateStringsArray(template)) {
    // biome-ignore lint/style/noNonNullAssertion: Already checked if the value exists
    if (template.length === 1) return template[0]!

    const combined: ClassValue[] = []
    for (let i = 0; i < template.length; i++) {
      // biome-ignore lint/style/noNonNullAssertion: Already checked if the value exists
      if (template[i]) combined.push(template[i]!.trim())
      if (i < params.length) combined.push(params[i])
    }
    return clsx(...combined)
  }

  return clsx(template, ...params)
}

/**
 * Tailwind-aware variant of {@link tw} that also runs the result through `twMerge`
 * to resolve conflicting utilities (e.g. `bg-red-500` vs `bg-blue-500`).
 *
 * This is great when you are composing lots of class names or variants and want the
 * “last one wins” behavior for Tailwind utilities without thinking about duplicates.
 *
 * Prefer {@link tw} by default for the lightest possible helper and only reach for `twm`
 * when you actually care about Tailwind-aware conflict resolution, since `twMerge`
 * is relatively heavy and you don’t want to pay that cost unnecessarily.
 *
 * @example Merging conflicting Tailwind utilities
 * ```ts
 * const classes = twm(
 *   'bg-red-500 p-2',
 *   isActive && 'bg-blue-500 p-4',
 * )
 * // => "bg-blue-500 p-4"
 * ```
 */
export const twm = (...props: Parameters<typeof tw>): string =>
  twMerge(tw(...props))
