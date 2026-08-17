import { ThreeDotsLoadingIcon } from '@/assets/icons'

interface LoadingSpinnerProps {
  title?: string
}

export const LoadingSpinner = ({ title }: LoadingSpinnerProps) => {
  return (
    <div className="p-8 gap-4 flex flex-row items-center justify-start text-muted-foreground">
      <ThreeDotsLoadingIcon className="size-6" />
      {title && (
        <p className="text-base font-medium text-muted-foreground">{title}</p>
      )}
    </div>
  )
}
