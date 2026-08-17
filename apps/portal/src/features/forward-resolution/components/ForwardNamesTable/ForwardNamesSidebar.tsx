import type { Row } from '@tanstack/react-table'
import type { FC, PropsWithChildren } from 'react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { ForwardNameDetails } from '../ForwardNameDetails'
import type { ForwardName } from './columns'

export const ForwardNamesSidebar: FC<
  PropsWithChildren<{
    row: Row<ForwardName> | null
    open: boolean
    setOpen: React.Dispatch<React.SetStateAction<boolean>>
  }>
> = ({ children, row, open, setOpen }) => {
  return (
    <Sheet open={open} onOpenChange={setOpen} defaultOpen={false}>
      {children}
      <SheetContent side="right" className="bg-background p-0">
        <div className="h-full overflow-y-auto">
          {row && <ForwardNameDetails {...row.original} />}
        </div>
      </SheetContent>
    </Sheet>
  )
}
