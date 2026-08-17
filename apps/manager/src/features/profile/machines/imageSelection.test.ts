import { describe, expect, it, vi } from 'vitest'
import { createActor } from 'xstate'
import { imageSelectionMachine } from './imageSelection'

const avatarNft = {
  avatarRecord:
    'eip155:11155111/erc721:0x1234567890abcdef1234567890abcdef12345678/42',
  collection: 'Checks Collection',
  id: '11155111:0x1234567890abcdef1234567890abcdef12345678:42',
  image: 'https://example.com/check.png',
  name: 'Check #42',
}

const anotherNft = {
  avatarRecord:
    'eip155:11155111/erc1155:0xabcdefabcdefabcdefabcdefabcdefabcdefabcd/7',
  collection: 'Editions',
  id: '11155111:0xabcdefabcdefabcdefabcdefabcdefabcdefabcd:7',
  image: 'https://example.com/edition.png',
  name: 'Edition #7',
}

const createImageSelectionActor = (onImageChange = vi.fn()) => {
  const actor = createActor(imageSelectionMachine, {
    input: {
      onImageChange,
      onImageRemove: vi.fn(),
    },
  })
  actor.start()
  return { actor, onImageChange }
}

describe('imageSelectionMachine NFT selection', () => {
  it('filters NFTs by name and collection while browsing', () => {
    const { actor } = createImageSelectionActor()

    actor.send({ type: 'SET_NFTS', nfts: [avatarNft, anotherNft] })
    actor.send({ type: 'OPEN_NFT_SELECTION' })
    actor.send({ type: 'UPDATE_NFT_SEARCH', query: 'edition' })

    expect(actor.getSnapshot().context.filteredNfts).toEqual([anotherNft])
  })

  it('confirms the selected NFT avatar record and preview image', () => {
    const { actor, onImageChange } = createImageSelectionActor()

    actor.send({ type: 'SET_NFTS', nfts: [avatarNft] })
    actor.send({ type: 'OPEN_NFT_SELECTION' })
    actor.send({ type: 'SELECT_NFT', nft: avatarNft })
    actor.send({ type: 'CONFIRM_NFT' })

    expect(onImageChange).toHaveBeenCalledWith(
      avatarNft.avatarRecord,
      avatarNft.image,
    )
    expect(actor.getSnapshot().matches('main')).toBe(true)
  })

  it('resets selected NFT and search state', () => {
    const { actor } = createImageSelectionActor()

    actor.send({ type: 'SET_NFTS', nfts: [avatarNft, anotherNft] })
    actor.send({ type: 'OPEN_NFT_SELECTION' })
    actor.send({ type: 'UPDATE_NFT_SEARCH', query: 'check' })
    actor.send({ type: 'SELECT_NFT', nft: avatarNft })
    actor.send({ type: 'RESET' })

    expect(actor.getSnapshot().context.nftSearchQuery).toBe('')
    expect(actor.getSnapshot().context.selectedNft).toBeNull()
    expect(actor.getSnapshot().context.filteredNfts).toEqual([])
  })
})
