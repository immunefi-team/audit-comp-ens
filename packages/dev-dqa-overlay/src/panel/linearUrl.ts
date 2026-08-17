/** Best-effort Linear URL when only an issue identifier is known. */
export const linearIssueUrl = (identifier: string): string =>
  `https://linear.app/search?q=${encodeURIComponent(identifier)}`
