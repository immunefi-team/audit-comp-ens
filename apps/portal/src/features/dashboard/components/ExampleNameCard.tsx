import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const ExampleNameCard = ({
  name,
  description,
  link,
}: {
  name: string
  description: string
  link?: string
}) => {
  const to = link ? `/$name/${link}` : '/$name'

  return (
    <div className="p-4 rounded-sm border border-border flex flex-row justify-between items-center gap-4">
      <div className="flex flex-row justify-between items-start gap-4">
        <div>
          <h4 className="font-semibold text-base mb-1 font-mono">{name}</h4>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Button asChild variant="secondary" size="sm">
        <Link to={to} params={{ name }}>
          <ChevronRight />
        </Link>
      </Button>
    </div>
  )
}
