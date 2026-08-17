import type { Row } from '@tanstack/react-table'
import type { FC, PropsWithChildren } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import type { ProtocolVersion } from '@/utils/types'
import { RecordDetails } from '../RecordDetails'
import type { NameRecord } from './columns'

export const RecordSidebar: FC<
  PropsWithChildren<{
    row: Row<NameRecord> | null
    name: string
    open: boolean
    setOpen: React.Dispatch<React.SetStateAction<boolean>>
    protocolVersion?: ProtocolVersion
  }>
> = ({ children, row, name, open, setOpen, protocolVersion }) => {
  const isMobile = useIsMobile()

  return (
    <Sheet open={open} onOpenChange={setOpen} defaultOpen={false}>
      {children}
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className="bg-background p-0 flex flex-col h-dvh"
      >
        <div className="p-6 pb-0 shrink-0">
          <SheetHeader className="p-0">
            <SheetTitle className="font-sans text-h2 capitalize">
              {row?.original.type} record
            </SheetTitle>
          </SheetHeader>
        </div>

        <div className="flex-1 overflow-y-auto">
          {row ? (
            <RecordDetails
              record={row.original}
              name={name}
              protocolVersion={protocolVersion}
            />
          ) : (
            <div className="text-muted-foreground text-center py-12">
              No record selected
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
