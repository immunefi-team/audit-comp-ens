import { useMediaQuery } from '@ens-apps/utils/useMediaQuery'
import { Trans, useLingui } from '@lingui/react/macro'
import { Share as ShareIcon } from 'lucide-react'
import { type CSSProperties, type ReactNode, useMemo, useState } from 'react'
import QRCodeImport from 'react-qr-code'
import { toast } from 'sonner'
import { EnsMobileIcon } from '@/assets/icons/ens-mobile-icon'
import * as ImageFallback from '@/components/atoms/ImageFallback'
import { PatternAvatar } from '@/components/atoms/PatternAvatar/PatternAvatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { MSymbol } from '@/components/ui/material-symbol'
import {
  DEFAULT_THEME_COLOR,
  type ProfileTheme,
} from '@/features/profile/constants'
import {
  getProfileTheme,
  getThemeVars,
} from '@/features/profile/utils/themeColor'
import { cn } from '@/lib/utils'
import { resolveDefaultExport } from './ShareProfileDialog.helpers'

const QRCode = resolveDefaultExport(QRCodeImport)
const DEFAULT_QR_BACKGROUND_COLOR = '#EEEDED'
const DEFAULT_QR_COLOR = '#353535'
const GARNET_SHARE_BUTTON_BACKGROUND_COLOR = '#FFB0D0'

type ShareDialogStyle = CSSProperties & {
  readonly '--share-button-bg': string
  readonly '--share-button-hover-bg': string
  readonly '--share-button-text': string
  readonly '--share-close-color': string
  readonly '--share-qr-bg': string
}

const getShareDialogStyle = (profileTheme: ProfileTheme): ShareDialogStyle => {
  const themeVars = getThemeVars(profileTheme.value)
  const isDefaultTheme = profileTheme.value === DEFAULT_THEME_COLOR

  return {
    '--share-button-bg':
      profileTheme.label === 'Garnet'
        ? GARNET_SHARE_BUTTON_BACKGROUND_COLOR
        : themeVars['--theme-button-bg'],
    '--share-button-hover-bg': themeVars['--theme-button-hover-bg'],
    '--share-button-text': themeVars['--theme-button-text'],
    '--share-close-color': isDefaultTheme
      ? profileTheme.buttonTextColor
      : profileTheme.value,
    '--share-qr-bg': isDefaultTheme
      ? DEFAULT_QR_BACKGROUND_COLOR
      : themeVars['--theme-button-bg'],
  }
}

type ShareAvatarProps = {
  readonly avatarUrl?: string
  readonly className?: string
  readonly name: string
  readonly themeColor: string
}

const ShareAvatar = ({
  avatarUrl,
  className,
  name,
  themeColor,
}: ShareAvatarProps) => (
  <div
    className={cn(
      'shrink-0 overflow-hidden rounded-[1px] bg-white shadow-[0_3px_12px_rgba(0,0,0,0.12)]',
      className,
    )}
  >
    <ImageFallback.Root className="contents">
      {avatarUrl ? (
        <ImageFallback.Image
          alt={`${name} avatar`}
          className="size-full object-cover"
          src={avatarUrl}
        />
      ) : null}
      <ImageFallback.Fallback>
        <PatternAvatar
          className="size-full rounded-[1px] border-none bg-transparent p-0 shadow-none"
          color={themeColor}
          name={name}
        />
      </ImageFallback.Fallback>
    </ImageFallback.Root>
  </div>
)

type ShareNameplateProps = {
  readonly avatarUrl?: string
  readonly hasQrCode: boolean
  readonly isLongName: boolean
  readonly name: string
  readonly profileTheme: ProfileTheme
  readonly themeColor: string
}

const ShareNameplate = ({
  avatarUrl,
  hasQrCode,
  isLongName,
  name,
  profileTheme,
  themeColor,
}: ShareNameplateProps) => {
  const { badgeClassName, badgeTextClassName } = profileTheme.preview

  if (isLongName) {
    return (
      <div className="flex w-full flex-col items-center gap-0.5">
        <div
          className={cn(
            'flex size-11.25 items-center justify-center rounded-[3px] p-2',
            badgeClassName,
          )}
        >
          <ShareAvatar
            avatarUrl={avatarUrl}
            className="size-7.25"
            name={name}
            themeColor={themeColor}
          />
        </div>
        <div
          className={cn(
            'w-full rounded-[3px] p-2 font-medium font-semi-mono text-[16px] leading-[0.96] md:text-[12px]',
            'break-all',
            badgeClassName,
            badgeTextClassName,
          )}
        >
          {name}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex h-11.25 items-center justify-center gap-1.25 rounded p-1.5',
        'md:h-8.75 md:gap-2',
        hasQrCode ? 'w-full max-w-65.75 md:max-w-55.5' : 'w-fit max-w-65.75',
        badgeClassName,
      )}
    >
      <ShareAvatar
        avatarUrl={avatarUrl}
        className="size-7.25 md:size-4.75"
        name={name}
        themeColor={themeColor}
      />
      <div
        className={cn(
          'min-w-0 font-medium font-semi-mono text-[28px] leading-[0.96] md:text-[20px]',
          'truncate',
          badgeTextClassName,
        )}
      >
        {name}
      </div>
    </div>
  )
}

type ShareCardHeaderProps = {
  readonly Close: typeof DialogClose | typeof DrawerClose
  readonly Title: typeof DialogTitle | typeof DrawerTitle
}

const ShareCardHeader = ({ Close, Title }: ShareCardHeaderProps) => (
  <div className="relative h-14.75 shrink-0">
    <EnsMobileIcon className="absolute top-4.25 left-4.25 h-5.5 w-4.75 text-(--share-close-color)" />
    {/* text-[#353535] / text-[16px]: design-specified exact values, no token equivalent */}
    <Title className="absolute top-5 left-1/2 w-30.25 -translate-x-1/2 text-center font-normal font-sans text-[#353535] text-[16px] leading-normal">
      <Trans>Share profile link</Trans>
    </Title>
    <Close asChild>
      <button
        aria-label="Close"
        className="absolute top-0 right-0 flex size-13 appearance-none items-center justify-center border-0 bg-transparent p-0 text-(--share-close-color) shadow-none outline-none transition-opacity hover:opacity-75 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:size-15"
        type="button"
      >
        <MSymbol
          className="ms-wght-200 text-[24px] md:text-[32px]"
          symbol="close"
        />
      </button>
    </Close>
  </div>
)

type ShareQrCodeProps = {
  readonly isDefaultTheme: boolean
  readonly safeUrl: string
}

const ShareQrCode = ({ isDefaultTheme, safeUrl }: ShareQrCodeProps) => (
  <div className="flex size-55.5 items-center justify-center rounded bg-(--share-qr-bg) p-2.25">
    <QRCode
      bgColor="transparent"
      fgColor={isDefaultTheme ? DEFAULT_QR_COLOR : 'var(--share-button-text)'}
      size={204}
      value={safeUrl}
    />
  </div>
)

type ShareActionButtonProps = {
  readonly children: ReactNode
  readonly className: string
  readonly onClick: () => void | Promise<void>
}

const ShareActionButton = ({
  children,
  className,
  onClick,
}: ShareActionButtonProps) => (
  <button
    className={cn(
      'flex h-12.5 min-w-0 appearance-none items-center justify-center gap-2 rounded border-0 px-4 shadow-none',
      // tracking-[0.12em]: design-specified exact value, no token equivalent
      'font-medium font-mono text-xs uppercase leading-none tracking-[0.12em] transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className,
    )}
    onClick={onClick}
    type="button"
  >
    {children}
  </button>
)

interface ShareProfileDialogProps {
  readonly name: string
  readonly url: string
  readonly avatarUrl?: string
  readonly themeColor?: string | null
  readonly trigger?: ReactNode
}

export const ShareProfileDialog = ({
  name,
  url,
  avatarUrl,
  themeColor,
  trigger,
}: ShareProfileDialogProps) => {
  const { t } = useLingui()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const profileTheme = getProfileTheme(themeColor)
  const shareDialogStyle = getShareDialogStyle(profileTheme)
  const isDefaultTheme = profileTheme.value === DEFAULT_THEME_COLOR
  const isLongName = name.length > 38

  const safeUrl = useMemo(() => {
    // Ensure absolute URL for QR and native share
    try {
      const u = new URL(
        url,
        typeof window === 'undefined'
          ? 'https://app.ens.domains'
          : window.location.origin,
      )
      return u.toString()
    } catch {
      return url
    }
  }, [url])

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) setCopied(false)
  }

  const handleNativeShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `${name} – ENS Profile`, url: safeUrl })
      } else {
        await navigator.clipboard.writeText(safeUrl)
        toast.success(t`Link copied to clipboard`)
      }
    } catch {
      // user canceled or unsupported – no-op
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(safeUrl)
      toast.success(t`Link copied to clipboard`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const triggerButton = trigger ?? (
    <Button size="sm" variant="outline">
      <ShareIcon className="size-3" />
      <Trans>Share</Trans>
    </Button>
  )

  const profileCard = ({ Close, Title }: ShareCardHeaderProps): ReactNode => (
    <>
      <ShareCardHeader Close={Close} Title={Title} />
      <div
        className={cn(
          'mx-auto flex w-full flex-col items-center gap-0.5',
          isDesktop
            ? cn('max-w-55.5', isLongName ? 'h-98.75' : 'h-64.75')
            : 'h-55.75 max-w-85 justify-center',
        )}
      >
        <ShareNameplate
          avatarUrl={avatarUrl}
          hasQrCode={isDesktop}
          isLongName={isLongName}
          name={name}
          profileTheme={profileTheme}
          themeColor={profileTheme.value}
        />
        {isDesktop ? (
          <ShareQrCode isDefaultTheme={isDefaultTheme} safeUrl={safeUrl} />
        ) : null}
      </div>
      <div className="mx-5 mt-7 grid h-12.5 grid-cols-2 gap-2">
        {/* text-[#f6fbfd] / bg-[#1A1919] / text-[#EEEDED]: design-specified exact values, no token equivalent */}
        <ShareActionButton
          className={
            isDefaultTheme
              ? 'bg-ens-lapis-500 text-[#f6fbfd] hover:bg-ens-lapis-core'
              : 'bg-[#1A1919] text-[#EEEDED] hover:bg-ens-quartz-700'
          }
          onClick={handleCopy}
        >
          {/* tracking-[0.12em]: design-specified exact value, no token equivalent */}
          <MSymbol
            className="ms-opsz-20 ms-wght-500 text-xs tracking-[0.12em]"
            symbol={copied ? 'check' : 'link'}
          />
          {copied ? <Trans>Copied</Trans> : <Trans>Copy Link</Trans>}
        </ShareActionButton>
        {/* bg-(--share-button-bg) / text-(--share-button-text) / hover:bg-(--share-button-hover-bg): theme-specific CSS variables, no static token equivalent */}
        <ShareActionButton
          className={
            isDefaultTheme
              ? 'bg-ens-quartz-200 text-ens-quartz-700 hover:bg-ens-quartz-250'
              : 'bg-(--share-button-bg) text-(--share-button-text) hover:bg-(--share-button-hover-bg)'
          }
          onClick={handleNativeShare}
        >
          {/* tracking-[0.12em]: design-specified exact value, no token equivalent */}
          <MSymbol
            className="ms-opsz-20 ms-wght-500 text-xs tracking-[0.12em]"
            symbol="share"
          />
          <Trans>Share</Trans>
        </ShareActionButton>
      </div>
    </>
  )

  if (isDesktop) {
    return (
      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogTrigger asChild>{triggerButton}</DialogTrigger>
        <DialogContent
          aria-describedby={undefined}
          className="w-[320px] max-w-[320px] gap-0 overflow-y-auto rounded-3xl border-0 bg-white p-0 pb-5 shadow-[0_4px_24px_rgba(7,28,47,0.07)]"
          showCloseButton={false}
          style={shareDialogStyle}
        >
          {profileCard({ Close: DialogClose, Title: DialogTitle })}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer onOpenChange={handleOpenChange} open={open}>
      <DrawerTrigger asChild>{triggerButton}</DrawerTrigger>
      <DrawerContent
        aria-describedby={undefined}
        className="gap-0 overflow-hidden rounded-t-3xl border-0 bg-white p-0 shadow-[0_4px_24px_rgba(7,28,47,0.07)] data-[vaul-drawer-direction=bottom]:max-h-[calc(100dvh-20px)] [&>div:first-child]:hidden"
        style={shareDialogStyle}
      >
        <div className="flex max-h-[calc(100dvh-20px)] flex-col overflow-y-auto pb-5">
          {profileCard({ Close: DrawerClose, Title: DrawerTitle })}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
