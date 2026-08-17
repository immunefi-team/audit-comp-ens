import { Badge } from '@/components/ui/badge'

export const UpNextItem = ({
  icon: Icon,
  title,
  description,
  status,
}: {
  icon: React.ElementType
  title: string
  description: string
  status: string
}) => (
  <div className="w-full p-4 rounded-sm border border-border">
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
      <Badge variant="secondary" className="text-xs">
        <span> {status}</span>
      </Badge>
    </div>
  </div>
)
