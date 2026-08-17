import { describe, expect, it } from 'vitest'
import { render } from '@/utils/test-utils'
import { ConnectWallet } from './ConnectWallet'

describe('ConnectWallet', () => {
  it('renders ConnectWallet', () => {
    const { getByText } = render(<ConnectWallet />)
    expect(getByText('Connect Wallet')).toBeInTheDocument()
  })
})
