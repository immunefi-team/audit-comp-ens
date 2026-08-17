import { mutationOptions } from '@tanstack/react-query'
import type { WalletClient } from 'viem'
import { signMessage } from 'viem/actions'
import { createSiweMessage } from 'viem/siwe'
import {
  backendAuthStore,
  backendClient,
  getSiweDomain,
  getSiweUri,
} from '@/utils/backend-client'

const getNonce = async () => {
  const response = await backendClient.auth.nonce.$post()
  if (!response.ok) {
    const { error } = await response.json()
    throw new Error(`Failed to get nonce: ${response.statusText} ${error}`)
  }

  return response.json().then((data) => data.nonce)
}

export const signInBackendMutation = mutationOptions({
  mutationFn: async ({ walletClient }: { walletClient: WalletClient }) => {
    const account = walletClient.account

    if (!account?.address) {
      throw new Error('No account found')
    }

    const nonce = await getNonce()

    const domain = getSiweDomain()
    const uri = getSiweUri()

    const siweMessage = createSiweMessage({
      address: account.address,
      domain,
      nonce,
      chainId: walletClient.chain?.id ?? 0,
      uri,
      version: '1',
    })

    const signedMessage = await signMessage(walletClient, {
      message: siweMessage,
      account,
    })

    const response = await backendClient.auth.login.$post({
      json: {
        address: account.address,
        message: siweMessage,
        signature: signedMessage,
        nonce,
      },
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(
        `Failed to login: ${response.statusText} ${JSON.stringify(data, null, 2)}`,
      )
    }

    const token = await response.json().then((data) => data.token)

    backendAuthStore.trigger.signIn({
      authKey: token,
      address: account.address,
    })
  },
})
