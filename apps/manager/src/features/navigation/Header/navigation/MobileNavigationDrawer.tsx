import { useLingui } from '@lingui/react/macro'
import { useState } from 'react'
import * as Drawer from '@/components/ui/drawer'
import { MSymbol } from '@/components/ui/material-symbol'
import { NavigationContent } from './NavigationContent'

export const MobileNavigationDrawer = () => {
  const { t } = useLingui()
  const [open, setOpen] = useState(false)

  const handleClose = () => {
    setOpen(false)
  }

  return (
    <Drawer.Drawer onOpenChange={setOpen} open={open}>
      <Drawer.DrawerTrigger asChild>
        <button
          aria-label={t`Open navigation`}
          className="flex size-9 items-center justify-center rounded-md text-ens-blue-midnight transition-colors hover:bg-ens-gray-two/50"
          type="button"
        >
          <MSymbol className="ms-opsz-24" symbol="dehaze" />
        </button>
      </Drawer.DrawerTrigger>
      <Drawer.DrawerContent className="space-y-6 px-4.5 pb-14">
        <NavigationContent onAction={handleClose} />
      </Drawer.DrawerContent>
    </Drawer.Drawer>
  )
}
