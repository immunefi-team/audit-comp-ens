import * as ImageFallback from '@/components/atoms/ImageFallback'
import { PatternAvatar } from '@/components/atoms/PatternAvatar/PatternAvatar'
import { cn } from '@/lib/utils'
import { useProfileThemeColor } from './ProfileThemeColor'

type ProfileAvatarProps = {
  readonly avatarLoading: boolean
  readonly avatarUrl?: string
  readonly className?: string
  readonly name: string
}

export const ProfileAvatar = ({
  avatarLoading,
  avatarUrl,
  className,
  name,
}: ProfileAvatarProps) => {
  const themeColor = useProfileThemeColor()

  return (
    <div
      className={cn(
        'relative size-45.5 shrink-0 overflow-hidden rounded-[18.889px] bg-ens-quartz-100 shadow-[0_4px_16px_rgba(0,0,0,0.12)]',
        className,
      )}
    >
      <ImageFallback.Root className="contents">
        <ImageFallback.Image
          alt={`${name} avatar`}
          className="size-full object-cover"
          src={avatarUrl}
        />
        <ImageFallback.Fallback>
          <PatternAvatar
            className="size-full rounded-[18.889px] border-none bg-transparent p-0 shadow-none"
            color={themeColor}
            name={name}
          />
          {avatarLoading ? (
            <div className="absolute inset-0 animate-pulse rounded-[18.889px] bg-ens-quartz-100/70" />
          ) : null}
        </ImageFallback.Fallback>
      </ImageFallback.Root>
    </div>
  )
}
