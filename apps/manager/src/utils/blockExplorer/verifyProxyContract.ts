import type { Address, Chain } from 'viem'

/**
 * Triggers Etherscan's proxy-contract verification for a freshly deployed
 * proxy. This is the programmatic equivalent of the "Is this a proxy?" button
 * on Etherscan: it makes Etherscan read the proxy's EIP-1967 implementation
 * slot on-chain and link the proxy to the (already source-verified)
 * implementation, lighting up the Read/Write-as-Proxy tabs.
 *
 * It does NOT submit any source code, so it needs no compiler input and — for
 * the proxy-resolution action specifically — is fully keyless. No Etherscan API
 * key is ever sent.
 *
 * The API host is derived from the chain's own block-explorer config, since all
 * deployments happen on the single chain the app targets (Sepolia today,
 * mainnet later) — no multichain routing involved.
 *
 * Designed to be fire-and-forget: it never throws and never blocks the deploy
 * flow. A failed/slow verification just means the dev clicks the button
 * manually, which is the pre-existing behaviour.
 */

const POLL_INTERVAL_MS = 5_000
const MAX_POLL_ATTEMPTS = 12 // ~1 minute

const buildUrl = (apiUrl: string, params: Record<string, string>): string => {
  const search = new URLSearchParams(params)
  return `${apiUrl}?${search.toString()}`
}

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Polls `checkproxyverification` until Etherscan reports a terminal state or we
 * exhaust attempts. Best-effort: any error/timeout resolves quietly.
 */
const pollProxyVerification = async (
  apiUrl: string,
  guid: string,
): Promise<void> => {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    await delay(POLL_INTERVAL_MS)
    try {
      const res = await fetch(
        buildUrl(apiUrl, {
          module: 'contract',
          action: 'checkproxyverification',
          guid,
        }),
      )
      const json = (await res.json()) as { status?: string; result?: string }
      // status "1" => verified; a non-"Pending" result also means terminal.
      if (json.status === '1' || (json.result && json.result !== 'Pending')) {
        return
      }
    } catch {
      return
    }
  }
}

/**
 * Kick off proxy verification for `address` on the given chain. Returns a
 * promise that resolves once verification reaches a terminal state (or quietly
 * on any failure). Safe to call without awaiting.
 *
 * @param chain - The chain the proxy was deployed on (Sepolia/mainnet, which
 *   always define an Etherscan API URL).
 * @param address - The deployed proxy address
 */
export const verifyProxyContract = async (
  chain: Chain,
  address: Address,
): Promise<void> => {
  try {
    const apiUrl = chain.blockExplorers?.default.apiUrl
    if (!apiUrl) return
    const res = await fetch(
      buildUrl(apiUrl, {
        module: 'contract',
        action: 'verifyproxycontract',
        address,
      }),
      { method: 'POST' },
    )
    const json = (await res.json()) as { status?: string; result?: string }

    // On success Etherscan returns a GUID to poll; otherwise bail quietly.
    if (json.status === '1' && json.result) {
      await pollProxyVerification(apiUrl, json.result)
    }
  } catch {
    // Fire-and-forget: never surface verification failures to the deploy flow.
  }
}
