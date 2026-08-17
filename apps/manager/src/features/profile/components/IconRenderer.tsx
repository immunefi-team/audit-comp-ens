import { safeImageSrc } from '../utils/safeUrl'

interface IconRendererProps {
  icon: React.FC<{ className?: string }> | string | undefined
  className: string
}

export const IconRenderer = ({ icon: Icon, className }: IconRendererProps) => {
  if (!Icon) return null

  if (typeof Icon === 'string') {
    const src = Icon.startsWith('/') ? Icon : safeImageSrc(Icon)
    if (!src) return null
    return <img alt="icon" className={className} src={src} />
  }

  return <Icon className={className} />
}
