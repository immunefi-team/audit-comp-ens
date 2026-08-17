import { Loader2Icon } from 'lucide-react'
import * as ImageFallback from '@/components/atoms/ImageFallback'
import { PatternAvatar } from '@/components/atoms/PatternAvatar/PatternAvatar'
import { MSymbol } from '@/components/ui/material-symbol'
import { useConnectedAvatar } from '@/features/wallet/hooks/useConnectedAvatar'
import { useConnectedReverseName } from '@/features/wallet/hooks/useConnectedReverseName'
import { useSmartAccountContext } from '@/lib/smart-account/SmartAccountContext'
import { getHeaderDisplayName } from './displayName'

export const AccountTriggerContent = () => {
  const { ownerAddress, isLoading } = useSmartAccountContext()
  const reverseNameQuery = useConnectedReverseName()
  const avatar = useConnectedAvatar()

  return (
    <>
      <div className="flex min-w-0 items-center gap-2 md:gap-2">
        <div className="flex size-7.5 shrink-0 items-center justify-center md:size-[46px]">
          {avatar.isLoading ? (
            <Loader2Icon className="size-4 animate-spin rounded-full bg-ens-gray-two md:size-5" />
          ) : (
            <ImageFallback.Root className="contents">
              <ImageFallback.Image
                alt="ENS Avatar"
                className="size-full rounded-sm object-cover"
                src={avatar.url ?? undefined}
              />
              <ImageFallback.Fallback>
                <PatternAvatar
                  className="size-full rounded-sm border-none bg-transparent p-0 shadow-none"
                  color={avatar.themeColor}
                  name={reverseNameQuery.data ?? ownerAddress ?? 'wallet'}
                />
              </ImageFallback.Fallback>
            </ImageFallback.Root>
          )}
        </div>

        <span className="min-w-0 truncate font-normal text-gray-700 text-sm leading-tight tracking-tight md:text-lg md:leading-ens-tight md:tracking-[-0.32px]">
          {getHeaderDisplayName({
            isLoading,
            ownerAddress,
            reverseName: reverseNameQuery.data ?? null,
          })}
        </span>
      </div>
      <MSymbol
        className="ms-font-rounded shrink-0 transition-transform duration-200 group-data-[state=open]:-rotate-180 group-data-popup-open:-rotate-180"
        symbol="keyboard_arrow_down"
      />
    </>
  )
}
