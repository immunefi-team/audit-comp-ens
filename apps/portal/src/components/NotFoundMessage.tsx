import { HelpCircle } from 'lucide-react'
import { MessageCard } from '@/components/ui/message-card'

interface NotFoundMessageProps {
  title?: string
  description?: React.ReactNode
}

export function NotFoundMessage({
  title = 'Not found',
  description,
}: NotFoundMessageProps) {
  const defaultDescription = (
    <>
      The page you were looking for wasn't found.
      <br />
      You can search for a name or address, or{' '}
      <a
        href="https://support.ens.domains/en/"
        className="underline decoration-dotted"
      >
        visit our support
      </a>{' '}
      for further help.
    </>
  )

  return (
    <MessageCard
      variant="warning"
      icon={<HelpCircle size={24} strokeWidth={1.5} />}
      title={title}
      description={description || defaultDescription}
    />
  )
}
