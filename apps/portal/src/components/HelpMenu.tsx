import { ExternalLink } from 'react-external-link'

const MENU_ITEM_CLASS =
  'flex flex-row items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-muted transition-colors'

export const HelpMenu = () => {
  return (
    <div className="flex flex-col gap-1">
      <ExternalLink
        className={MENU_ITEM_CLASS}
        href="https://app.ens.domains/legal/terms-of-use"
      >
        Terms of Use
      </ExternalLink>
      <ExternalLink
        className={MENU_ITEM_CLASS}
        href="https://app.ens.domains/legal/privacy-policy"
      >
        Privacy Policy
      </ExternalLink>
      <ExternalLink
        className={MENU_ITEM_CLASS}
        href="https://ens.domains/legal/trademark-guidelines"
      >
        Trademark Guidelines
      </ExternalLink>
      <ExternalLink
        className={MENU_ITEM_CLASS}
        href="https://support.ens.domains/"
      >
        Support
      </ExternalLink>
    </div>
  )
}
