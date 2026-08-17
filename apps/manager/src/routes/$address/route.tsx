import { createFileRoute } from '@tanstack/react-router'
import { isAddress } from 'viem'

export const Route = createFileRoute('/$address')({
  params: {
    parse: (rawParams) => {
      if (!isAddress(rawParams.address, { strict: false })) {
        throw new Error('Not an address')
      }

      return {
        address: rawParams.address,
      }
    },
  },
  skipRouteOnParseError: {
    params: true,
    // Prioritize address over names since addresses are more strict.
    priority: 100,
  },
})
