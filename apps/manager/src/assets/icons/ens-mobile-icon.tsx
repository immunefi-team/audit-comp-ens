import ensMobileSrc from '@/assets/icons/ens-mobile.svg'
import { cn } from '@/lib/utils'

type EnsMobileIconProps = {
  className?: string
}

const maskImage = `url("${ensMobileSrc}")`

export const EnsMobileIcon = ({ className }: EnsMobileIconProps) => {
  return (
    <span
      aria-hidden
      className={cn('inline-block h-6 w-[22px] shrink-0 bg-current', className)}
      style={{
        maskImage,
        WebkitMaskImage: maskImage,
        maskSize: 'contain',
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
      }}
    />
  )
}
