import { Trans } from '@lingui/react/macro'
import { ExternalLink } from 'lucide-react'
import { useMemo } from 'react'
import type { ProfileRecords } from '@/features/profile/types'
import { cn } from '@/lib/utils'
import {
  cardSurfaceClassName,
  ProfileCard,
  profileCardTrailingIconStrokeWidth,
  valueClassName,
} from './ProfileCard'
import { getGeneratedLinkPattern } from './ProfileLinks.helpers'
import {
  getSafeProfileLinks,
  type SafeProfileLink,
} from './ProfileView.helpers'

const linkPreviewClassName = cn(
  cardSurfaceClassName,
  'group flex h-51.25 min-w-0 flex-col overflow-hidden p-0 text-left',
)
const linkPreviewPanelClassName = 'h-30 shrink-0 overflow-hidden bg-white'

const LinkPreview = ({ link }: { readonly link: SafeProfileLink }) => {
  const pattern = useMemo(() => getGeneratedLinkPattern(link.href), [link.href])

  return (
    <a
      className={linkPreviewClassName}
      href={link.href}
      rel="noopener noreferrer"
      target="_blank"
      title={link.href}
    >
      <div
        aria-hidden="true"
        className={linkPreviewPanelClassName}
        data-link-pattern-id={pattern.patternId}
        data-link-pattern-palette-id={pattern.paletteId}
        data-link-pattern-variant={pattern.variant}
        data-testid="link-pattern-panel"
        style={{
          backgroundImage: pattern.backgroundImage,
          backgroundPosition: 'left top',
          backgroundRepeat: 'repeat',
          backgroundSize: '80px 80px',
        }}
      />
      <div className="min-w-0 px-6 py-5">
        <div className="truncate text-ens-quartz-900 text-sm leading-normal">
          {link.name}
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-1 text-ens-quartz-500">
          <span className={`${valueClassName} truncate`}>
            {link.displayHost}
          </span>
          <ExternalLink
            className="size-4 shrink-0 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            strokeWidth={profileCardTrailingIconStrokeWidth}
          />
        </div>
      </div>
    </a>
  )
}

export const ProfileLinksSection = ({
  records,
}: {
  readonly records: ProfileRecords
}) => {
  const links = getSafeProfileLinks(records)
  if (links.length === 0) return null

  return (
    <ProfileCard title={<Trans>Links</Trans>}>
      <div className="grid gap-4 lg:landscape:grid-cols-3 lg:landscape:gap-6">
        {links.map((link) => (
          <LinkPreview key={`${link.name}-${link.href}`} link={link} />
        ))}
      </div>
    </ProfileCard>
  )
}
