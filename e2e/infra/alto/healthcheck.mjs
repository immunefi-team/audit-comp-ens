#!/usr/bin/env node
/** One-shot healthcheck: POST eth_chainId to localhost:4337 (Alto). Exit 0 if OK. */
import http from 'node:http'

const body = JSON.stringify({
  jsonrpc: '2.0',
  method: 'eth_chainId',
  params: [],
  id: 1,
})

const req = http.request(
  {
    hostname: '127.0.0.1',
    port: 4337,
    path: '/',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  },
  (res) => {
    let data = ''
    res.on('data', (c) => (data += c))
    res.on('end', () => {
      try {
        process.exit(JSON.parse(data).result ? 0 : 1)
      } catch {
        process.exit(1)
      }
    })
  },
)
req.on('error', () => process.exit(1))
req.setTimeout(3000, () => {
  req.destroy()
  process.exit(1)
})
req.end(body)
