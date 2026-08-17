import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$name')({
  params: {
    parse: ({ name }) => {
      if (name.length < 3 || !name.includes('.')) {
        throw new Error('Invalid ENS name')
      }

      return {
        name,
      }
    },
  },
  skipRouteOnParseError: {
    params: true,
    // Prioritize address over names since addresses are more strict.
    priority: 50,
  },
})
