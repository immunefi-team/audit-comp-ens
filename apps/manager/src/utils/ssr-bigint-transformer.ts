/**
 * BigInt round-trip transformer for TanStack Query's SSR dehydrate/hydrate.
 *
 * `JSON.stringify` cannot serialize bigints — and using
 * `BigInt.prototype.toJSON = () => JSON.rawJSON(...)` to dodge that throws
 * away precision for any value above `Number.MAX_SAFE_INTEGER`, because the
 * client's `JSON.parse` decodes unquoted numerics through float64 (this is
 * what previously broke EIP-712 signing in MetaMask/Zerion).
 *
 * Instead, we tag bigints with a marker object on the server during
 * dehydration and restore them on the client during hydration. The marker
 * key is chosen to be unlikely to collide with any real field name in our
 * query data.
 */
const BIGINT_TAG = '__ENS_BIGINT__'

type BigIntMarker = { readonly [BIGINT_TAG]: string }

function isBigIntMarker(value: object): value is BigIntMarker {
  return typeof (value as Partial<BigIntMarker>)[BIGINT_TAG] === 'string'
}

export function serializeBigInts(data: unknown): unknown {
  if (typeof data === 'bigint') {
    return { [BIGINT_TAG]: data.toString() } satisfies BigIntMarker
  }
  if (Array.isArray(data)) {
    return data.map(serializeBigInts)
  }
  if (data !== null && typeof data === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(data)) {
      out[key] = serializeBigInts((data as Record<string, unknown>)[key])
    }
    return out
  }
  return data
}

export function deserializeBigInts(data: unknown): unknown {
  if (data === null || typeof data !== 'object') {
    return data
  }
  if (Array.isArray(data)) {
    return data.map(deserializeBigInts)
  }
  if (isBigIntMarker(data)) {
    return BigInt(data[BIGINT_TAG])
  }
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(data)) {
    out[key] = deserializeBigInts((data as Record<string, unknown>)[key])
  }
  return out
}
