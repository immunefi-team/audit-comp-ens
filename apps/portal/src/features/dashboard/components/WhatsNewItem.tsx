import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

type RouteConfig =
  | {
      to: '/$name' | '/$name/history' | '/$name/resolver'
      params: { name: string }
    }
  | {
      to:
        | '/addr/$addr'
        | '/addr/$addr/reverse-resolution'
        | '/addr/$addr/resolution'
      params: { addr: string }
    }

export const WhatsNewItem = ({
  icon: Icon,
  title,
  description,
  ...route
}: {
  icon: React.ElementType
  title: string
  description: string
} & RouteConfig) => (
  <button
    type="button"
    className="w-full p-4 rounded-sm border border-border hover:border-border transition-colors text-left group"
  >
    <div className="flex flex-row justify-between items-center gap-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-sm shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-semibold text-base mb-1">{title}</h4>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Button asChild variant="secondary" size="sm">
        <Link to={route.to} params={route.params}>
          <ChevronRight />
        </Link>
      </Button>
    </div>
  </button>
)
