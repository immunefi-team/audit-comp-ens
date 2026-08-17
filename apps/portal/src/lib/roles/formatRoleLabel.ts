/**
 * Strip the `ROLE_` prefix / `_ADMIN` suffix and Title-Case a raw role name,
 * e.g. `ROLE_SET_RESOLVER_ADMIN` -> `Set Resolver`.
 */
export const formatRoleLabel = (role: string) =>
  role
    .replace(/^ROLE_/, '')
    .replace(/_ADMIN$/, '')
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
