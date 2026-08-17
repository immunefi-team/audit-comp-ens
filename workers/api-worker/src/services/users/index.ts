import { ResultFn } from '@ens-apps/utils/neverthrow'
import { eq } from 'drizzle-orm'
import { ok } from 'neverthrow'
import type { Address } from 'viem'
import { type Database, intoDbResult } from '#core/database/index.js'
import { users } from '#core/database/schema/index.js'

export const addUserIfNotExists = ResultFn(async function* (
  db: Database,
  address: Address,
) {
  const existingUser = yield* intoDbResult(
    db.query.users.findFirst({
      where: eq(users.address, address.toLowerCase()),
    }),
  )

  if (existingUser) {
    return ok(existingUser)
  }

  return intoDbResult(
    db
      .insert(users)
      .values({
        address: address.toLowerCase(),
      })
      .returning()
      .then((result) => result[0]),
  )
})
