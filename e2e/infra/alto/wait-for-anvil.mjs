#!/usr/bin/env node
/**
 * Poll Anvil RPC until eth_chainId succeeds.
 * Used as a pre-start step for Alto so it doesn't race the fork initializing.
 */
import dns from 'node:dns'
import http from 'node:http'

// Prefer IPv4 so container-to-container name resolution works reliably
dns.setDefaultResultOrder('ipv4first')

const ANVIL_RPC = process.env.ANVIL_RPC || 'http://host.docker.internal:8545'
const MAX_ATTEMPTS = 60
const DELAY_MS = 2000
const INITIAL_DELAY_MS = 3000

const url = new URL(ANVIL_RPC)
const port = parseInt(
  url.port || (url.protocol === 'https:' ? '443' : '80'),
  10,
)
const body = JSON.stringify({
  jsonrpc: '2.0',
  method: 'eth_chainId',
  params: [],
  id: 1,
})

function check(hostname) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname,
        port,
        path: url.pathname || '/',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => {
          try {
            const j = JSON.parse(data)
            // Valid JSON-RPC response has .result (or .error); chainId returns hex string
            const ok = j && j.result !== undefined
            if (process.env.DEBUG && !ok)
              console.error('Anvil response:', data?.slice(0, 200))
            resolve(ok)
          } catch (e) {
            if (process.env.DEBUG)
              console.error(
                'Parse error:',
                e.message,
                'body:',
                data?.slice(0, 200),
              )
            resolve(false)
          }
        })
      },
    )
    req.on('error', (err) => {
      if (process.env.DEBUG)
        console.error('Anvil check error:', err.code || err.message)
      resolve(false)
    })
    req.setTimeout(5000, () => {
      req.destroy()
      resolve(false)
    })
    req.end(body)
  })
}

async function tryCheck() {
  const hostname = url.hostname
  const ok = await check(hostname)
  if (ok) return true
  // If hostname is "anvil", try resolving to IPv4 and connect by IP (works around DNS quirks)
  if (hostname === 'anvil') {
    try {
      const { address } = await dns.promises.lookup('anvil', { family: 4 })
      if (address) return await check(address)
    } catch (_) {}
  }
  return false
}

// Short initial delay for network attach
console.log('Waiting for Anvil at', ANVIL_RPC)
await new Promise((r) => setTimeout(r, INITIAL_DELAY_MS))

for (let i = 0; i < MAX_ATTEMPTS; i++) {
  if (await tryCheck()) {
    console.log('Anvil RPC ready at', ANVIL_RPC)
    process.exit(0)
  }
  if (i < MAX_ATTEMPTS - 1) {
    console.log('Waiting for Anvil...', i + 1)
    await new Promise((r) => setTimeout(r, DELAY_MS))
  }
}

console.error('Anvil did not become ready in time')
process.exit(1)
