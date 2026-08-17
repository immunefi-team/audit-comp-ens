import {
  readContract,
  waitForTransactionReceipt,
  writeContract,
} from '@wagmi/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CommemorativeNftClaimError,
  claimCommemorativeNft,
  decodeCommemorativeNftClaimError,
  readCommemorativeNftClaimed,
  waitForCommemorativeNftClaimReceipt,
} from './contract'
import { getCommemorativeNftClaimedRefetchInterval } from './queries'

vi.mock('@wagmi/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@wagmi/core')>()),
  readContract: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
  writeContract: vi.fn(),
}))

const writeContractMock = vi.mocked(writeContract)
const readContractMock = vi.mocked(readContract)
const waitForTransactionReceiptMock = vi.mocked(waitForTransactionReceipt)
const ownerAddress = '0x03Ba34f6Ea1496fa316873CF8350A3f7eaD317EF'
const proof = [
  '0x017995f95e79303c1853e326b15e6dcc16e6aa20f07372e4f0ab63c0b84f2631',
] as const
const wagmiConfig = {} as Parameters<
  typeof claimCommemorativeNft
>[0]['wagmiConfig']

describe('commemorative NFT contract', () => {
  beforeEach(() => vi.clearAllMocks())

  it('submits a plain EOA claim', async () => {
    writeContractMock.mockResolvedValue('0xabc')
    await expect(
      claimCommemorativeNft({
        wagmiConfig,
        chainId: 11155111,
        ownerAddress,
        walletAddress: ownerAddress,
        proof,
      }),
    ).resolves.toBe('0xabc')

    expect(writeContractMock).toHaveBeenCalledWith(
      wagmiConfig,
      expect.objectContaining({
        account: ownerAddress,
        functionName: 'claim',
        args: [proof],
      }),
    )
  })

  it('refuses to mint from a different wallet', async () => {
    await expect(
      claimCommemorativeNft({
        wagmiConfig,
        chainId: 11155111,
        ownerAddress,
        walletAddress: '0x538cDec1cb3e7A874D473E36558F535Ba2343B83',
        proof,
      }),
    ).rejects.toMatchObject({ reason: 'wallet-mismatch' })
    expect(writeContractMock).not.toHaveBeenCalled()
  })

  it('refuses to mint when the contract is unavailable on the active chain', async () => {
    await expect(
      claimCommemorativeNft({
        wagmiConfig,
        chainId: 10,
        ownerAddress,
        walletAddress: ownerAddress,
        proof,
      }),
    ).rejects.toMatchObject({ reason: 'unsupported-network' })
    expect(writeContractMock).not.toHaveBeenCalled()
  })

  it('reads claimed state directly from the contract', async () => {
    readContractMock.mockResolvedValue(true)
    await expect(
      readCommemorativeNftClaimed({
        wagmiConfig,
        chainId: 11155111,
        ownerAddress,
      }),
    ).resolves.toBe(true)
  })

  it('classifies rejection and contract errors', () => {
    expect(
      decodeCommemorativeNftClaimError(
        new Error('UserRejectedRequestError: user rejected request'),
      ).reason,
    ).toBe('user-rejected')
    expect(
      decodeCommemorativeNftClaimError(new Error('InvalidProof()')).reason,
    ).toBe('invalid-proof')
    expect(
      decodeCommemorativeNftClaimError(
        new CommemorativeNftClaimError('already-claimed', 'already'),
      ).reason,
    ).toBe('already-claimed')
  })

  it('rejects a reverted claim receipt', async () => {
    waitForTransactionReceiptMock.mockResolvedValue({
      status: 'reverted',
    } as Awaited<ReturnType<typeof waitForTransactionReceipt>>)

    await expect(
      waitForCommemorativeNftClaimReceipt({
        wagmiConfig,
        chainId: 11155111,
        hash: '0xabc',
      }),
    ).rejects.toMatchObject({ reason: 'reverted' })
  })

  it('polls only while a submitted claim remains unconfirmed', () => {
    expect(
      getCommemorativeNftClaimedRefetchInterval({
        poll: true,
        claimed: false,
      }),
    ).toBe(2_000)
    expect(
      getCommemorativeNftClaimedRefetchInterval({
        poll: true,
        claimed: true,
      }),
    ).toBe(false)
    expect(
      getCommemorativeNftClaimedRefetchInterval({
        poll: false,
        claimed: false,
      }),
    ).toBe(false)
  })
})
