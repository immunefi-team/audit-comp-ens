import { logger } from '@ens-apps/utils/logger'
import { Wallet } from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import type { Connector } from 'wagmi'
import { useConnect, useConnectors } from 'wagmi'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { wagmiConfig } from '@/lib/wagmi'
import {
  isCoinbase,
  isConnectionCancelled,
  isMetaMask,
  METAMASK_DOWNLOAD_URL,
  normalizeConnectError,
  resolveConnectChainId,
  WALLETCONNECT_ID,
} from './connect.helpers'
import { CoinbaseIcon, MetaMaskIcon, WalletConnectIcon } from './WalletIcons'

type WalletRowProps = {
  readonly icon: ReactNode
  readonly name: string
  readonly badge?: string
  readonly isPending?: boolean
  readonly disabled?: boolean
} & (
  | { readonly onClick: () => void; readonly href?: never }
  | { readonly href: string; readonly onClick?: never }
)

const WalletRow = ({
  icon,
  name,
  badge,
  isPending,
  disabled,
  onClick,
  href,
}: WalletRowProps) => {
  const content = (
    <>
      <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-xs">
        {icon}
      </span>
      <span className="font-medium text-sm">{name}</span>
      <span className="ml-auto text-muted-foreground text-xs">
        {isPending ? 'Connecting…' : badge}
      </span>
    </>
  )

  const className = cn(
    'flex w-full cursor-pointer items-center gap-3 rounded-xs border bg-background px-3 py-2.5 text-left transition-colors',
    'hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-60',
  )

  if (href) {
    return (
      <a
        aria-label={`Install ${name}`}
        className={className}
        href={href}
        rel="noreferrer"
        target="_blank"
      >
        {content}
      </a>
    )
  }

  return (
    <button
      className={className}
      disabled={disabled || isPending}
      onClick={onClick}
      type="button"
    >
      {content}
    </button>
  )
}

// A single row in the connect list: either a connectable wallet (has a
// `connector`) or a link out to install one (has an `href`).
type WalletOption = {
  readonly key: string
  readonly icon: ReactNode
  readonly name: string
  readonly badge?: string
} & (
  | { readonly connector: Connector; readonly href?: never }
  | { readonly href: string; readonly connector?: never }
)

type ConnectWalletDialogProps = {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

export const ConnectWalletDialog = ({
  open,
  onOpenChange,
}: ConnectWalletDialogProps) => {
  const connectors = useConnectors()
  const { mutateAsync: connectAsync } = useConnect()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Clear the error when the dialog closes so the next open starts fresh. We
  // must NOT clear on open: reopening after a WalletConnect *failure* needs to
  // preserve the error set in the connect handler. `pendingId` is intentionally
  // left to connect()'s `finally` so it stays set while a WalletConnect pairing
  // is in flight (our dialog is closed then), keeping the concurrency guard
  // active if the dialog is reopened from elsewhere.
  useEffect(() => {
    if (!open) {
      setError(null)
    }
  }, [open])

  const metaMask = connectors.find(isMetaMask)
  const coinbase = connectors.find(isCoinbase)
  const walletConnect = connectors.find((c) => c.id === WALLETCONNECT_ID)

  // Other injected wallets (Rabby, Frame, …), deduped by `uid` so wallets that
  // share a display name aren't collapsed into one.
  const otherWallets = useMemo(() => {
    const seen = new Set<string>()
    return connectors.filter((c) => {
      if (c.type !== 'injected' || isMetaMask(c) || isCoinbase(c)) return false
      if (seen.has(c.uid)) return false
      seen.add(c.uid)
      return true
    })
  }, [connectors])

  // A connection is mid-flight (any connector, including a WalletConnect
  // pairing while our dialog is closed).
  const isConnecting = pendingId !== null

  // A deliberate dismissal of WalletConnect's own modal needs no app-level
  // error — that modal WAS the UI the user cancelled. But a real pairing
  // failure (timeout, relay error) would otherwise vanish with both modals
  // closed, so reopen ours with the error.
  const handleConnectError = (e: unknown, usesOwnModal: boolean) => {
    // Log the RAW error before it is normalised away.
    //
    // `normalizeConnectError` deliberately returns fixed copy so technical
    // detail never reaches the UI, and `isConnectionCancelled` matches on
    // message text as loosely as /cancell?ed/i. Between them a genuine
    // failure -- a bad relay, a blocked origin, an aborted request -- is
    // indistinguishable from the user closing the prompt, and nothing else
    // records it. That left "Connection cancelled" on screen as the only
    // evidence of failures that were never a cancellation.
    logger.error('[wallet] connect failed', {
      usesOwnModal,
      classifiedAsCancelled: isConnectionCancelled(e),
      name: e instanceof Error ? e.name : typeof e,
      message: e instanceof Error ? e.message : String(e),
      // EIP-1193 puts the real reason (4001 = user rejected) on the error or
      // its cause chain; viem wraps provider errors, so the top level often
      // carries neither.
      code: (e as { code?: unknown })?.code,
      cause: (e as { cause?: unknown })?.cause,
      error: e,
    })

    if (usesOwnModal && isConnectionCancelled(e)) return

    setError(normalizeConnectError(e))
    if (usesOwnModal) onOpenChange(true)
  }

  const connect = async (connector: Connector) => {
    // Guard against a second concurrent attempt: two in-flight connects would
    // let each one's `finally` clear the other's pending indicator.
    if (isConnecting) return
    setError(null)
    // Set pending first so the guard above holds for the whole attempt. For
    // WalletConnect this stays set while its own QR modal is open (our dialog
    // is closed), so reopening the dialog from elsewhere can't start a second
    // connect. Cleared in `finally`.
    setPendingId(connector.uid)

    // WalletConnect renders its own full-screen QR modal, so close ours first
    // to avoid stacking; injected/Coinbase keep ours open with a per-row
    // "Connecting…" state and dismiss it only on success.
    const usesOwnModal = connector.id === WALLETCONNECT_ID
    if (usesOwnModal) {
      onOpenChange(false)
    }

    try {
      // Connect on a supported chain so wallets that default to mainnet land on
      // the right chain from the first connect.
      const walletChainId = await connector.getChainId()
      const chainId = resolveConnectChainId(walletChainId, wagmiConfig.chains)
      await connectAsync({ connector, chainId })
      onOpenChange(false)
    } catch (e) {
      handleConnectError(e, usesOwnModal)
    } finally {
      setPendingId(null)
    }
  }

  // Curated wallets first, in priority order; MetaMask falls back to an install
  // link when it isn't detected.
  const prioritizedWallets: WalletOption[] = [
    metaMask
      ? {
          key: 'metamask',
          icon: <MetaMaskIcon className="size-8" />,
          name: 'MetaMask',
          badge: 'Detected',
          connector: metaMask,
        }
      : {
          key: 'metamask',
          icon: <MetaMaskIcon className="size-8" />,
          name: 'MetaMask',
          badge: 'Install',
          href: METAMASK_DOWNLOAD_URL,
        },
    ...(coinbase
      ? [
          {
            key: 'coinbase',
            icon: <CoinbaseIcon className="size-8" />,
            name: 'Coinbase Wallet',
            connector: coinbase,
          },
        ]
      : []),
    ...(walletConnect
      ? [
          {
            key: 'walletconnect',
            icon: <WalletConnectIcon className="size-8" />,
            name: 'WalletConnect',
            connector: walletConnect,
          },
        ]
      : []),
  ]

  // EIP-6963-discovered injected wallets, shown after the curated ones.
  const discoveredWallets: WalletOption[] = otherWallets.map((connector) => ({
    key: connector.uid,
    icon: connector.icon ? (
      <img alt="" className="size-8 rounded-xs" src={connector.icon} />
    ) : (
      <Wallet className="size-5 text-muted-foreground" />
    ),
    name: connector.name,
    connector,
  }))

  const renderWallet = (option: WalletOption) => {
    if (!option.connector) {
      return (
        <WalletRow
          badge={option.badge}
          href={option.href}
          icon={option.icon}
          key={option.key}
          name={option.name}
        />
      )
    }
    const { connector } = option
    return (
      <WalletRow
        badge={option.badge}
        disabled={isConnecting}
        icon={option.icon}
        isPending={pendingId === connector.uid}
        key={option.key}
        name={option.name}
        onClick={() => connect(connector)}
      />
    )
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="gap-5 p-8 sm:max-w-100">
        <DialogHeader>
          <DialogTitle>Connect a wallet</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {prioritizedWallets.map(renderWallet)}

          {discoveredWallets.length > 0 && (
            <div className="mt-1 flex items-center gap-2 px-1">
              <span className="h-px flex-1 bg-border" />
              <span className="text-muted-foreground text-xs">Detected</span>
              <span className="h-px flex-1 bg-border" />
            </div>
          )}

          {discoveredWallets.map(renderWallet)}
        </div>

        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
