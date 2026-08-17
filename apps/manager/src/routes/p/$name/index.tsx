import { createFileRoute, redirect } from '@tanstack/react-router'
import { isAddress } from 'viem'

export const Route = createFileRoute('/p/$name/')({
  beforeLoad: ({ params: { name } }) => {
    if (isAddress(name, { strict: false })) {
      throw redirect({ to: '/$address', params: { address: name } })
    }
    throw redirect({ to: '/$name', params: { name } })
  },
})
