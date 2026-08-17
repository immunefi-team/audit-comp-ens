import type { Role } from '@ensdomains/ensjs/utils/v2'
import { useEffect, useState } from 'react'
import {
  type Permission,
  roleToPermissions,
} from '@/lib/roles/rolesToPermissions'

export const useEditedPermissions = (
  row: { original: { items: string[]; account: string } } | null,
) => {
  const [editedPermissions, setEditedPermissions] = useState<
    Map<string, Permission>
  >(new Map())

  useEffect(() => {
    if (row) {
      const roles = (row.original.items ?? []) as Role[]
      setEditedPermissions(roleToPermissions(roles))
    }
  }, [row])

  return { editedPermissions, setEditedPermissions }
}
