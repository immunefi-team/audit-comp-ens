import { Search } from 'lucide-react'
import { useId } from 'react'
import { Label } from '@/components/ui/label'
import { SidebarInput } from '@/components/ui/sidebar'

export const SearchForm = ({ ...props }: React.ComponentProps<'form'>) => {
  const searchId = useId()
  return (
    <form {...props}>
      <div className="relative">
        <Label htmlFor={searchId} className="sr-only">
          Search
        </Label>
        <SidebarInput
          id={searchId}
          placeholder="Type to search..."
          className="h-8 pl-7"
        />
        <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 opacity-50 select-none" />
      </div>
    </form>
  )
}
