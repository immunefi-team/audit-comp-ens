import { useState } from 'react'
import * as Drawer from '@/components/ui/drawer'
import { AccountContent } from './AccountContent'
import { AccountTriggerButton } from './AccountTriggerButton'

export const MobileAccountDrawer = () => {
  const [open, setOpen] = useState(false)

  const handleClose = () => {
    setOpen(false)
  }

  return (
    <Drawer.Drawer onOpenChange={setOpen} open={open}>
      <Drawer.DrawerTrigger asChild>
        <AccountTriggerButton className="max-w-[190px]" />
      </Drawer.DrawerTrigger>
      <Drawer.DrawerContent className="space-y-8 px-4.5 pb-14">
        <AccountContent onAction={handleClose} />
      </Drawer.DrawerContent>
    </Drawer.Drawer>
  )
}
