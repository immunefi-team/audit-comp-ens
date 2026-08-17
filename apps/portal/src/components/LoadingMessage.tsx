import { ThreeDotsLoadingIcon } from '@/assets/icons'

interface LoadingMessageProps {
  title?: string
  description?: React.ReactNode
}

export function LoadingMessage({
  title = 'Surfacing everything you need.',
  description,
}: LoadingMessageProps) {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center gap-4 p-6 text-center">
      <ThreeDotsLoadingIcon className="size-9" />
      <h2 className="font-serif text-[22px] font-[350] leading-[1.35] text-foreground">
        {title}
      </h2>
      {description && (
        <div className="text-base leading-relaxed text-foreground max-w-md">
          {description}
        </div>
      )}
    </div>
  )
}
