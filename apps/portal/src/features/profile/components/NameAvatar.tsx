import type { CSSProperties } from 'react'
import { useEnsAvatar } from 'wagmi'
import { LogoSVG } from '@/assets/logo'
import { cn } from '@/lib/utils'

export const NameAvatar = ({
  name,
  height = '142px',
  width = '142px',
  rounded = 'rounded-sm',
}: {
  name: string
  height?: string
  width?: string
  rounded?: string
}) => {
  const {
    data: avatar,
    error,
    isLoading,
  } = useEnsAvatar({
    name,
    query: {
      enabled: name.endsWith('.eth'),
    },
  })

  const sizeStyle = {
    '--height': height,
    '--width': width,
  } as CSSProperties

  if (error || isLoading) {
    return (
      <div
        style={sizeStyle}
        className={cn(
          'bg-muted animate-pulse',
          rounded,
          'w-(--width) h-(--height)',
        )}
      />
    )
  }

  if (avatar)
    return (
      <img
        src={avatar}
        alt="avatar"
        className={rounded}
        height={height}
        width={width}
      />
    )

  const size = Number.parseInt(width, 10)
  const isLarge = size >= 80

  return (
    <div
      style={sizeStyle}
      className={cn(
        '[background:var(--avatar-placeholder-gradient)]',
        rounded,
        'relative overflow-hidden w-(--width) h-(--height)',
      )}
    >
      {isLarge && (
        <>
          <LogoSVG
            className="absolute text-white"
            style={{
              top: '10%',
              left: '10%',
              width: '20%',
              height: 'auto',
              opacity: 0.9,
            }}
          />
          <span
            className="absolute text-white font-bold leading-none truncate"
            style={{
              bottom: '10%',
              left: '10%',
              right: '10%',
              fontSize: `${Math.max(size * 0.11, 10)}px`,
            }}
          >
            {name}
          </span>
        </>
      )}
    </div>
  )
}
