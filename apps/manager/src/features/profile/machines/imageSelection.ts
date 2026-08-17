import { assign, setup } from 'xstate'
import type { AvatarNft } from '@/features/profile/service/profileNfts'

export interface ImageSelectionContext {
  onImageChange: (url: string, resolvedImage?: string) => void
  onImageRemove: () => void

  manualUrl: string
  nftSearchQuery: string
  selectedNft: AvatarNft | null
  nfts: readonly AvatarNft[]
  filteredNfts: readonly AvatarNft[]
  error: string | null
}

const initialContext: Omit<
  ImageSelectionContext,
  'onImageChange' | 'onImageRemove'
> = {
  manualUrl: '',
  nftSearchQuery: '',
  selectedNft: null,
  nfts: [],
  filteredNfts: [],
  error: null,
}

export const imageSelectionMachine = setup({
  types: {
    context: {} as ImageSelectionContext,
    events: {} as
      | { type: 'RESET' }
      | { type: 'OPEN_NFT_SELECTION' }
      | { type: 'OPEN_UPLOAD' }
      | { type: 'OPEN_MANUAL_INPUT' }
      | { type: 'OPEN_REMOVE_CONFIRMATION' }
      | { type: 'CANCEL' }
      | { type: 'BACK' }
      | { type: 'CONFIRM_REMOVAL' }
      | { type: 'SET_NFTS'; nfts: readonly AvatarNft[] }
      | { type: 'UPDATE_NFT_SEARCH'; query: string }
      | { type: 'SELECT_NFT'; nft: AvatarNft }
      | { type: 'CONFIRM_NFT' }
      | { type: 'UPDATE_MANUAL_URL'; url: string }
      | { type: 'PREVIEW_MANUAL_URL' }
      | { type: 'CONFIRM_MANUAL_URL' }
      | { type: 'SET_ERROR'; error: string }
      | { type: 'CLEAR_ERROR' },
    input: {} as {
      onImageChange: (url: string, resolvedImage?: string) => void
      onImageRemove: () => void
    },
  },
  actions: {
    resetContext: assign({
      ...initialContext,
    }),

    assignManualUrl: assign({
      manualUrl: ({ event }) => {
        if (event.type === 'UPDATE_MANUAL_URL') return event.url
        return ''
      },
    }),

    assignNfts: assign({
      nfts: ({ event }) => {
        if (event.type !== 'SET_NFTS') return []
        return event.nfts
      },
      filteredNfts: ({ context, event }) => {
        if (event.type !== 'SET_NFTS') return []
        const query = context.nftSearchQuery.trim().toLowerCase()
        if (!query) return event.nfts
        return event.nfts.filter(
          (nft) =>
            nft.name.toLowerCase().includes(query) ||
            nft.collection.toLowerCase().includes(query),
        )
      },
    }),

    assignNftSearchQuery: assign({
      nftSearchQuery: ({ event }) => {
        if (event.type === 'UPDATE_NFT_SEARCH') return event.query
        return ''
      },
    }),

    updateFilteredNfts: assign({
      filteredNfts: ({ context, event }) => {
        const query =
          event.type === 'UPDATE_NFT_SEARCH'
            ? event.query.trim().toLowerCase()
            : context.nftSearchQuery.trim().toLowerCase()

        if (!query) return context.nfts
        return context.nfts.filter(
          (nft) =>
            nft.name.toLowerCase().includes(query) ||
            nft.collection.toLowerCase().includes(query),
        )
      },
    }),

    assignSelectedNft: assign({
      selectedNft: ({ event }) => {
        if (event.type === 'SELECT_NFT') return event.nft
        return null
      },
    }),

    setError: assign({
      error: ({ event }) => {
        if (event.type === 'SET_ERROR') return event.error
        return 'An error occurred'
      },
    }),

    clearError: assign({
      error: null,
    }),

    setInvalidUrlError: assign({
      error: ({ context }) => {
        const url = context.manualUrl.trim()
        if (!url) return 'Please enter a URL'

        try {
          new URL(url)
          return 'Please enter a valid image URL'
        } catch {
          return 'Please enter a valid URL format (e.g., https://example.com/image.jpg)'
        }
      },
    }),

    handleManualUrlConfirmation: ({ context }) => {
      if (context.manualUrl.trim()) {
        context.onImageChange(context.manualUrl.trim())
      }
    },

    handleNftConfirmation: ({ context }) => {
      if (context.selectedNft) {
        context.onImageChange(
          context.selectedNft.avatarRecord,
          context.selectedNft.image,
        )
      }
    },

    handleImageRemoval: ({ context }) => {
      context.onImageRemove()
    },
  },
  guards: {
    isManualUrlValid: ({ context }) => {
      const url = context.manualUrl.trim()
      if (!url) return false

      try {
        const parsedUrl = new URL(url)
        // Check if it's a valid HTTP/HTTPS URL
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          return false
        }
        return true
      } catch {
        return false
      }
    },

    hasSelectedNft: ({ context }) => context.selectedNft !== null,
  },
}).createMachine({
  context: ({ input }) => ({
    ...initialContext,
    ...input,
  }),
  id: 'imageSelection',
  initial: 'main',
  on: {
    RESET: {
      target: '.main',
      actions: ['resetContext', 'clearError'],
    },
    SET_ERROR: {
      actions: 'setError',
    },
    CLEAR_ERROR: {
      actions: 'clearError',
    },
    SET_NFTS: {
      actions: 'assignNfts',
    },
  },
  states: {
    main: {
      on: {
        OPEN_NFT_SELECTION: 'nftSelection',
        OPEN_UPLOAD: 'uploadPreview',
        OPEN_MANUAL_INPUT: 'manualInput',
        OPEN_REMOVE_CONFIRMATION: 'removeConfirmation',
      },
    },

    nftSelection: {
      initial: 'browsing',
      on: {
        CANCEL: 'main',
        BACK: 'main',
      },
      states: {
        browsing: {
          on: {
            UPDATE_NFT_SEARCH: {
              actions: ['assignNftSearchQuery', 'updateFilteredNfts'],
            },
            SELECT_NFT: {
              actions: 'assignSelectedNft',
              target: 'confirming',
            },
          },
        },
        confirming: {
          on: {
            BACK: 'browsing',
            CONFIRM_NFT: [
              {
                guard: 'hasSelectedNft',
                actions: 'handleNftConfirmation',
                target: '#imageSelection.main',
              },
              {
                actions: 'setError',
              },
            ],
          },
        },
      },
    },

    uploadPreview: {
      on: {
        CANCEL: 'main',
        BACK: 'main',
      },
    },

    manualInput: {
      initial: 'entering',
      on: {
        CANCEL: 'main',
        BACK: 'main',
      },
      states: {
        entering: {
          on: {
            UPDATE_MANUAL_URL: {
              actions: ['assignManualUrl', 'clearError'],
            },
            PREVIEW_MANUAL_URL: [
              {
                guard: 'isManualUrlValid',
                target: 'previewing',
              },
              {
                actions: 'setInvalidUrlError',
              },
            ],
          },
        },
        previewing: {
          on: {
            CONFIRM_MANUAL_URL: {
              actions: 'handleManualUrlConfirmation',
              target: '#imageSelection.main',
            },
            BACK: 'entering',
          },
        },
      },
    },

    removeConfirmation: {
      on: {
        CANCEL: 'main',
        BACK: 'main',
        CONFIRM_REMOVAL: {
          actions: 'handleImageRemoval',
          target: 'main',
        },
      },
    },
  },
})
