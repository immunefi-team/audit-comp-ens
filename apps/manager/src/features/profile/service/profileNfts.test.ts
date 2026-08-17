import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildAlchemyNftsEndpoint,
  getNftChainPriority,
  mapAlchemyNftsToAvatarNfts,
} from './profileNfts'

describe('profile NFT helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('builds the Alchemy endpoint for the active NFT chain', () => {
    vi.stubEnv('VITE_ALCHEMY_NFT_API_KEY', 'test-key')

    expect(
      buildAlchemyNftsEndpoint({
        address: '0x0000000000000000000000000000000000000001',
        chainId: 11155111,
        limit: 24,
      }),
    ).toBe(
      'https://eth-sepolia.g.alchemy.com/nft/v3/test-key/getNFTsForOwner?owner=0x0000000000000000000000000000000000000001&pageSize=24&withMetadata=true&excludeFilters%5B%5D=SPAM',
    )
  })

  it('uses Sepolia only for NFT lookup', () => {
    expect(getNftChainPriority(1)).toEqual([11155111])
    expect(getNftChainPriority(11155111)).toEqual([11155111])
    expect(getNftChainPriority(8453)).toEqual([11155111])
  })

  it('maps supported Alchemy NFTs to ENS avatar records and filters unusable NFTs', () => {
    expect(
      mapAlchemyNftsToAvatarNfts({
        chainId: 11155111,
        nfts: [
          {
            contract: {
              address: '0x1234567890abcdef1234567890ABCDEF12345678',
              name: 'Checks',
              tokenType: 'ERC721',
            },
            tokenId: '42',
            name: 'Check #42',
            image: {
              cachedUrl: 'ipfs://bafybeicheck/image.png',
            },
            collection: {
              name: 'Checks Collection',
            },
          },
          {
            contract: {
              address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
              name: 'Editions',
              tokenType: 'ERC1155',
            },
            tokenId: '7',
            name: null,
            image: {
              originalUrl: 'https://example.com/edition.png',
            },
          },
          {
            contract: {
              address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
              tokenType: 'ERC20',
            },
            tokenId: '1',
            image: {
              originalUrl: 'https://example.com/not-nft.png',
            },
          },
          {
            contract: {
              address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
              tokenType: 'ERC721',
            },
            tokenId: '2',
          },
        ],
      }),
    ).toEqual([
      {
        avatarRecord:
          'eip155:11155111/erc721:0x1234567890abcdef1234567890abcdef12345678/42',
        collection: 'Checks Collection',
        id: '11155111:0x1234567890abcdef1234567890abcdef12345678:42',
        image: 'https://ipfs.euc.li/ipfs/bafybeicheck/image.png',
        name: 'Check #42',
      },
      {
        avatarRecord:
          'eip155:11155111/erc1155:0xabcdefabcdefabcdefabcdefabcdefabcdefabcd/7',
        collection: 'Editions',
        id: '11155111:0xabcdefabcdefabcdefabcdefabcdefabcdefabcd:7',
        image: 'https://example.com/edition.png',
        name: '#7',
      },
    ])
  })
})
