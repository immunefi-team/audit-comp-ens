import { UnfoldVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'

type CollapseAllButtonProps = {
  onToggle: () => void
  isCollapsed?: boolean
}

export const CollapseAllButton = ({
  onToggle,
  isCollapsed = false,
}: CollapseAllButtonProps) => {
  return (
    <Button variant="outline" onClick={onToggle} className="gap-2 min-w-36">
      <UnfoldVertical className="h-4 w-4" />
      <span>{isCollapsed ? 'Expand all' : 'Collapse all'}</span>
    </Button>
  )
}
