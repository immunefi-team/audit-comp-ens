import { Trans } from '@lingui/react/macro'
import { Loader2, Menu } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Address } from 'viem'
import { DialogClose } from '@/components/ui/dialog'
import { TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { PreparedProfileImageUpload } from '@/features/profile/service/profileImageUpload'
import type { ProfileRecords } from '@/features/profile/types'
import { cn } from '@/lib/utils'
import { useEditProfileDialogStatus } from './EditProfileDialog.context'
import { AddressesTab } from './tabs/addresses/AddressesTab'
import { AppearanceTab } from './tabs/appearance/AppearanceTab'
import { ContactTab } from './tabs/contact/ContactTab'
import { GeneralTab } from './tabs/general/GeneralTab'
import { LinksTab } from './tabs/links/LinksTab'

const tabs = [
  { label: 'General', value: 'general' },
  { label: 'Contact', value: 'contact' },
  { label: 'Addresses', value: 'addresses' },
  { label: 'Links', value: 'links' },
  { label: 'Appearance', value: 'appearance' },
] as const

interface EditProfileDialogTabsProps {
  readonly canSave: boolean
  readonly name: string
  readonly onAddressesChange: (addresses: ProfileRecords['addresses']) => void
  readonly onBaseChange: (base: ProfileRecords['base']) => void
  readonly onContactChange: (contact: ProfileRecords['contact']) => void
  readonly onDraftLinkValidationIssuesChange: (
    hasValidationIssues: boolean,
  ) => void
  readonly onLinksChange: (links: ProfileRecords['links']) => void
  readonly onImageUploadPrepared?: (upload: PreparedProfileImageUpload) => void
  readonly onSave: () => void
  readonly onSocialChange: (social: ProfileRecords['social']) => void
  readonly owner?: Address
  readonly preparedImageUploads: readonly PreparedProfileImageUpload[]
  readonly values: ProfileRecords
}

interface EditProfileTabListProps {
  readonly className?: string
  readonly onSelect?: () => void
}

const EditProfileTabList = ({
  className,
  onSelect,
}: EditProfileTabListProps) => (
  <TabsList
    className={cn(
      'flex h-full flex-col items-stretch justify-start gap-0.5 rounded-none border-ens-quartz-200 border-r bg-white p-2',
      className,
    )}
  >
    {tabs.map(({ label, value }) => (
      <TabsTrigger
        className="h-10 w-full flex-none justify-start whitespace-nowrap rounded-lg p-3 font-normal text-[14px] text-ens-quartz-500 tracking-[0.14px] data-[state=active]:bg-[#f2f2f2] data-[state=active]:text-ens-quartz-500"
        key={value}
        onClick={onSelect}
        value={value}
      >
        {label}
      </TabsTrigger>
    ))}
  </TabsList>
)

interface MobileProfileActionsProps {
  readonly canSave: boolean
  readonly isMenuOpen: boolean
  readonly isSaving: boolean
  readonly onMenuToggle: () => void
  readonly onSave: () => void
}

const MobileProfileActions = ({
  canSave,
  isMenuOpen,
  isSaving,
  onMenuToggle,
  onSave,
}: MobileProfileActionsProps) => (
  <div className="flex shrink-0 items-start gap-1 px-[17px] py-2 md:hidden">
    <button
      aria-expanded={isMenuOpen}
      aria-label={isMenuOpen ? 'Close edit sections' : 'Open edit sections'}
      className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-ens-quartz-100 text-ens-quartz-500 transition-colors hover:bg-ens-quartz-150"
      onClick={onMenuToggle}
      type="button"
    >
      <Menu className="size-5.5" />
    </button>
    <button
      className="flex h-10 min-w-0 shrink items-center justify-center gap-2 rounded-sm bg-ens-lapis-500 px-2 font-mono text-[14.81px] text-ens-lapis-100 uppercase leading-[1.2] tracking-[0.1481px] transition-colors hover:bg-ens-lapis-core disabled:pointer-events-none disabled:opacity-50"
      disabled={!canSave || isSaving}
      onClick={onSave}
      type="button"
    >
      {isSaving && <Loader2 className="size-4 animate-spin" />}
      {isSaving ? <Trans>Saving</Trans> : <Trans>Save Profile</Trans>}
    </button>
    <DialogClose asChild>
      <button
        className="flex h-10 shrink-0 items-center justify-center rounded-sm bg-ens-lapis-100 px-2 font-mono text-[14.81px] text-ens-lapis-500 uppercase leading-[1.2] tracking-[0.1481px] transition-colors hover:bg-ens-lapis-100/80 disabled:pointer-events-none disabled:opacity-50"
        disabled={isSaving}
        type="button"
      >
        <Trans>Cancel</Trans>
      </button>
    </DialogClose>
  </div>
)

export const EditProfileDialogTabs = ({
  canSave,
  name,
  onAddressesChange,
  onBaseChange,
  onContactChange,
  onDraftLinkValidationIssuesChange,
  onImageUploadPrepared,
  onLinksChange,
  onSave,
  onSocialChange,
  owner,
  preparedImageUploads,
  values,
}: EditProfileDialogTabsProps) => {
  const { isSaving } = useEditProfileDialogStatus()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )

  const handleScroll = useCallback(() => {
    setIsScrolling(true)

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }

    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false)
    }, 650)
  }, [])

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
      <div className="hidden shrink-0 pb-5 pl-4 md:block">
        <EditProfileTabList className="w-29.5" />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div
          className="scrollbar-scroll-only min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4 pt-4 pb-4 [-webkit-overflow-scrolling:touch] [scrollbar-gutter:stable] md:px-4"
          data-scrolling={isScrolling}
          onScroll={handleScroll}
        >
          <TabsContent className="min-h-0 flex-1" value="general">
            <GeneralTab
              name={name}
              onBaseChange={onBaseChange}
              onContactChange={onContactChange}
              onImageUploadPrepared={onImageUploadPrepared}
              owner={owner}
              preparedImageUploads={preparedImageUploads}
              values={values}
            />
          </TabsContent>

          <TabsContent className="min-h-0 flex-1" value="contact">
            <ContactTab
              onBaseChange={onBaseChange}
              onContactChange={onContactChange}
              onSocialChange={onSocialChange}
              values={values}
            />
          </TabsContent>

          <TabsContent className="min-h-0 flex-1" value="addresses">
            <AddressesTab
              onAddressesChange={onAddressesChange}
              values={values}
            />
          </TabsContent>

          <TabsContent className="min-h-0 flex-1" forceMount value="links">
            <LinksTab
              onDraftValidationIssuesChange={onDraftLinkValidationIssuesChange}
              onLinksChange={onLinksChange}
              values={values}
            />
          </TabsContent>

          <TabsContent className="min-h-0 flex-1" value="appearance">
            <AppearanceTab
              name={name}
              onBaseChange={onBaseChange}
              owner={owner}
              values={values}
            />
          </TabsContent>
        </div>
      </div>

      {mobileNavOpen ? (
        <div className="absolute inset-x-0 top-0 bottom-14 z-10 bg-white px-4 pt-1 md:hidden">
          <EditProfileTabList
            className="h-full w-full rounded-lg border border-ens-quartz-200"
            onSelect={() => setMobileNavOpen(false)}
          />
        </div>
      ) : null}

      <MobileProfileActions
        canSave={canSave}
        isMenuOpen={mobileNavOpen}
        isSaving={isSaving}
        onMenuToggle={() => setMobileNavOpen((open) => !open)}
        onSave={onSave}
      />
    </div>
  )
}
