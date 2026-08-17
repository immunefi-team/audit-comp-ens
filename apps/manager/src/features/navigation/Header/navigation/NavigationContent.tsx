import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Link, type LinkOptions, linkOptions } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import {
  GithubIcon,
  MessageCircleIcon,
  MessageSquareIcon,
  TwitterIcon,
  YoutubeIcon,
} from 'lucide-react'
import type React from 'react'
import ensMobile from '@/assets/icons/ens-mobile.svg'
import { MSymbol } from '@/components/ui/material-symbol'
import { EXPLORER_URL } from '@/constants'
import { twm } from '@/utils/tailwind'

type NavigationContentProps = {
  readonly onAction: () => void
}

type NavigationLink = {
  readonly label: MessageDescriptor
  readonly icon?: React.ReactNode
  readonly className?: string
  readonly suffix?: React.ReactNode
} & (
  | {
      readonly href: string
      readonly target?: '_blank'
      readonly rel?: 'noreferrer'
    }
  | {
      readonly linkOptions: LinkOptions
    }
)

type NavigationSection = {
  readonly title: MessageDescriptor | string
  readonly links: readonly NavigationLink[]
}

type SocialIcon = {
  readonly href: string
  readonly icon: LucideIcon
}

const LogoIconBlack = () => <img alt="Logo" src={ensMobile} />

const navigationSections: readonly NavigationSection[] = [
  {
    title: '',
    links: [
      {
        label: msg`ENS app landing page`,
        linkOptions: linkOptions({
          to: '/',
          search: {
            landing: true,
          },
        }),
        icon: <LogoIconBlack />,
        className: 'text-base',
      },
      {
        label: msg`Go to ENS Explorer`,
        href: EXPLORER_URL,
        className: 'text-base gap-1',
        suffix: (
          <MSymbol
            className="ms-opsz-30 hover:no-underline"
            symbol="arrow_outward"
          />
        ),
      },
    ],
  },
  {
    title: msg`Need help?`,
    links: [
      {
        label: msg`Support`,
        href: 'https://support.ens.domains',
        target: '_blank',
        rel: 'noreferrer',
      },
      {
        label: msg`Contact`,
        href: 'mailto:support@ens.domains',
      },
    ],
  },
  {
    title: msg`ENS`,
    links: [
      {
        label: msg`Privacy Policy`,
        linkOptions: linkOptions({
          to: '/legal/privacy-policy',
        }),
      },
      {
        label: msg`Terms of Use`,
        linkOptions: linkOptions({
          to: '/legal/terms-of-use',
        }),
      },
      {
        label: msg`Trademark Guidelines`,
        linkOptions: linkOptions({
          to: '/legal/trademark-guidelines',
        }),
      },
      {
        label: msg`Bug bounty`,
        href: 'https://immunefi.com/bug-bounty/ens/information',
        target: '_blank',
        rel: 'noreferrer',
      },
    ],
  },
  {
    title: msg`Join the community`,
    links: [
      {
        label: msg`Blog`,
        href: 'https://ens.domains/blog',
        target: '_blank',
        rel: 'noreferrer',
      },
      {
        label: msg`DAO Forum`,
        href: 'https://discuss.ens.domains/',
        target: '_blank',
        rel: 'noreferrer',
      },
    ],
  },
]

const socialIcons: readonly SocialIcon[] = [
  { href: 'https://x.com/ensdomains', icon: TwitterIcon },
  { href: 'https://github.com/ensdomains', icon: GithubIcon },
  { href: 'https://chat.ens.domains', icon: MessageCircleIcon },
  { href: 'https://support.ens.domains', icon: MessageSquareIcon },
  { href: 'https://www.youtube.com/@ENSdomains', icon: YoutubeIcon },
]

export const NavigationContent = ({ onAction }: NavigationContentProps) => {
  const { _ } = useLingui()

  const resolveTitle = (title: MessageDescriptor | string) =>
    typeof title === 'string' ? title : _(title)

  return (
    <div className="w-full space-y-6">
      {navigationSections.map((section, sectionIndex) => {
        const title = resolveTitle(section.title)
        return (
          <div key={title}>
            <div className="flex flex-col gap-3">
              {sectionIndex > 0 && <div className="border-gray-200 border-t" />}
              <h3 className="font-medium text-base text-ens-quartz-900">
                {title}
              </h3>
              <div className="flex flex-col gap-4">
                {section.links.map((link) => {
                  const label = _(link.label)
                  const isInternal = 'linkOptions' in link
                  const className = twm(
                    'text-ens-quartz-900 text-sm leading-ens-normal transition-colors flex items-center gap-2 group',
                    link.className,
                  )
                  const content = (
                    <>
                      {link.icon && <div className="size-6">{link.icon}</div>}
                      <span className="group-hover:underline">{label}</span>
                      {link.suffix}
                    </>
                  )
                  return isInternal ? (
                    <Link
                      className={className}
                      onClick={onAction}
                      {...link.linkOptions}
                      key={`${title}-${label}-${link.linkOptions.to}`}
                    >
                      {content}
                    </Link>
                  ) : (
                    <a
                      className={className}
                      href={link.href}
                      key={`${title}-${label}-${link.href}`}
                      onClick={onAction}
                      rel={link.rel}
                      target={link.target}
                    >
                      {content}
                    </a>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}

      <div className="flex items-center justify-center gap-4">
        {socialIcons.map(({ href, icon: Icon }) => (
          <a
            className="text-gray-500 transition-colors hover:text-ens-quartz-900"
            href={href}
            key={href}
            onClick={onAction}
            rel="noreferrer"
            target="_blank"
          >
            <Icon className="size-5" />
          </a>
        ))}
      </div>
    </div>
  )
}
