import { ChevronRight } from 'lucide-react'
import { ExternalLink } from 'react-external-link'
import { Button } from '@/components/ui/button'

export const LinkBlock = ({
  title,
  description,
  href,
}: {
  title: string
  description: string
  href: string
}) => (
  <div className="p-4 rounded-sm border border-border flex flex-row justify-between items-center gap-4">
    <div>
      <h3 className="font-semibold text-base mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
    <Button asChild variant="secondary" size="sm">
      <ExternalLink href={href}>
        <ChevronRight />
      </ExternalLink>
    </Button>
  </div>
)
