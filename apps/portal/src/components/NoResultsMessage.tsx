import { RemoveSelectionIcon } from '@/assets/icons'
import { MessageCard } from '@/components/ui/message-card'

interface NoResultsMessageProps {
  title?: string
  description?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}

export const NoResultsMessage = ({
  title = 'No results found',
  description,
  icon,
  className,
}: NoResultsMessageProps) => {
  const defaultDescription = "There's nothing here yet. Check back later!"

  return (
    <MessageCard
      icon={icon || <RemoveSelectionIcon className="size-5" />}
      title={title}
      description={description || defaultDescription}
      className={className}
    />
  )
}
