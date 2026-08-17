/**
 * Minimal JSON-RPC helpers for manipulating Anvil's clock from the browser.
 *
 * DEV / manual-testing ONLY. These call Anvil cheatcodes (`evm_*`) that only
 * exist on a local Anvil node. The default endpoint is the Vite dev proxy
 * `/rpc` (see `apps/portal/vite.config.ts` and `apps/manager/vite.config.ts`),
 * which forwards to the fork at `127.0.0.1:8545` with no CORS setup.
 *
 * This is the manual-browser counterpart to the e2e `testClient` calls in
 * `e2e/fixtures/time.ts` / `e2e/fixtures/makeName.ts`.
 */

/** Default endpoint — the Vite dev server proxies this to the Anvil fork. */
export const DEFAULT_RPC_ENDPOINT = '/rpc'

let rpcId = 0

async function rpc<T>(
  method: string,
  params: readonly unknown[],
  endpoint: string = DEFAULT_RPC_ENDPOINT,
): Promise<T> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  })

  if (!response.ok) {
    throw new Error(
      `[time-travel] RPC ${method} failed: HTTP ${response.status}`,
    )
  }

  const json = (await response.json()) as {
    result?: T
    error?: { message?: string }
  }

  if (json.error) {
    throw new Error(
      `[time-travel] RPC ${method} error: ${json.error.message ?? 'unknown'}`,
    )
  }

  return json.result as T
}

/** Current chain block timestamp, in milliseconds. */
export async function getBlockTimestampMs(endpoint?: string): Promise<number> {
  const block = await rpc<{ timestamp: string }>(
    'eth_getBlockByNumber',
    ['latest', false],
    endpoint,
  )
  return Number.parseInt(block.timestamp, 16) * 1000
}

/** Mine a single block so timestamp changes take effect. */
export async function mine(endpoint?: string): Promise<void> {
  await rpc('evm_mine', [], endpoint)
}

/**
 * Advance chain time by `seconds` and mine a block. Mirrors the e2e
 * `testClient.increaseTime({ seconds }) + mine()` from `fixtures/time.ts`.
 */
export async function increaseTime(
  seconds: number,
  endpoint?: string,
): Promise<void> {
  await rpc('evm_increaseTime', [Math.floor(seconds)], endpoint)
  await mine(endpoint)
}

/**
 * Set the next block's absolute timestamp (given in ms) and mine. Mirrors
 * `makeName.ts`'s `setNextBlockTimestamp` + `mine` for exact targeting.
 *
 * NOTE: Anvil only allows moving the timestamp forward; advancing past the
 * current block time is fine, rewinding is not.
 */
export async function setNextTimestampMs(
  timestampMs: number,
  endpoint?: string,
): Promise<void> {
  await rpc(
    'evm_setNextBlockTimestamp',
    [Math.floor(timestampMs / 1000)],
    endpoint,
  )
  await mine(endpoint)
}
