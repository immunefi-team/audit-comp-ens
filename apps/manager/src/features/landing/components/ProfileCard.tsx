import { Trans } from '@lingui/react/macro'
import { CalendarIcon } from 'lucide-react'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { formatDashboardDate } from '@/features/dashboard/utils'
import { tw, twm } from '@/utils/tailwind'

const COLOR_VARIANTS = {
  garnet: {
    bg: 'bg-[#FFEDF5]',
    border: 'border-[#FFEDF5]',
    bg2: 'bg-[#FBD5E7]',
    surface: {
      bg: 'bg-ens-garnet-surface',
      text: 'text-ens-garnet-surface',
    },
    core: {
      bg: 'bg-ens-garnet-core',
      text: 'text-ens-garnet-core',
    },
    dust: {
      bg: 'bg-ens-garnet-dust',
      text: 'text-ens-garnet-dust',
      border: 'border-ens-garnet-dust',
    },
  },
  lapis: {
    bg: 'bg-[#E3F1F5]',
    border: 'border-[#E3F1F5]',
    bg2: 'bg-sky-200',
    surface: {
      bg: 'bg-ens-lapis-surface',
      text: 'text-ens-lapis-surface',
    },
    core: {
      bg: 'bg-ens-lapis-core',
      text: 'text-ens-lapis-core',
    },
    dust: {
      bg: 'bg-ens-lapis-dust',
      text: 'text-ens-lapis-dust',
      border: 'border-ens-lapis-dust',
    },
  },
  peridot: {
    bg: 'bg-ens-peridot-bg',
    border: 'border-ens-peridot-bg',
    bg2: 'bg-[#CAE6D3]',
    surface: {
      bg: 'bg-ens-peridot-surface',
      text: 'text-ens-peridot-surface',
    },
    core: {
      bg: 'bg-ens-peridot-core',
      text: 'text-ens-peridot-core',
    },
    dust: {
      bg: 'bg-ens-peridot-dust',
      text: 'text-ens-peridot-dust',
      border: 'border-ens-peridot-dust',
    },
  },
}

export type ProfileCardVariant = keyof typeof COLOR_VARIANTS

export const ProfileCard = ({
  name,
  avatarUrl,
  registeredDate,
  description,
  links,
  variant,
  className,
  delay = 0,
}: {
  name: string
  avatarUrl: string
  registeredDate: Date
  description: string
  links: { icon: ReactNode; href: string; title: string }[]
  variant: ProfileCardVariant
  className?: string
  delay?: number
}) => {
  return (
    <motion.div
      className={twm(
        'w-full overflow-hidden rounded-xl',
        COLOR_VARIANTS[variant].bg,
        className,
      )}
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      transition={{
        duration: 0.5,
        delay,
        ease: 'easeOut',
      }}
      viewport={{ once: false, margin: '-80px' }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
    >
      <div
        className={tw`relative mb-18 h-32 w-full ${COLOR_VARIANTS[variant].surface.bg}`}
      >
        <img
          alt={name}
          className={tw`absolute -bottom-1/2 left-5 size-32 rounded-full border-4 ${COLOR_VARIANTS[variant].border}`}
          src={avatarUrl}
        />
      </div>

      <div className="px-4 pb-4">
        <p
          className={tw`w-fit rounded-sm p-2.5 font-medium text-ens-white text-lg leading-ens-none ${COLOR_VARIANTS[variant].core.bg}`}
        >
          {name}
        </p>
        <p
          className={tw`mt-3 flex items-center gap-1.5 font-normal font-sans text-sm ${COLOR_VARIANTS[variant].surface.text}`}
        >
          <span>
            <CalendarIcon className="inline-block size-4" />{' '}
            <Trans>Registered</Trans>{' '}
          </span>
          <span
            className={tw`font-medium ${COLOR_VARIANTS[variant].core.text}`}
          >
            {formatDashboardDate(registeredDate)}
          </span>
        </p>

        <p
          className={tw`mt-4 font-serif text-base leading-ens-none ${COLOR_VARIANTS[variant].core.text}`}
        >
          {description}
        </p>

        <div className={tw`my-4 h-px w-full ${COLOR_VARIANTS[variant].bg2}`} />
        <p
          className={tw`mb-3 font-medium text-lg ${COLOR_VARIANTS[variant].core.text}`}
        >
          <Trans>links</Trans>
        </p>
        <div className="flex flex-wrap gap-2">
          {links.map(({ icon, href, title }) => (
            <a
              className={tw`flex items-center gap-1 rounded-sm p-2 ${COLOR_VARIANTS[variant].bg2}`}
              href={href}
              key={href}
              rel="noopener noreferrer"
              target="_blank"
            >
              <span
                className={tw`size-4 ${COLOR_VARIANTS[variant].surface.text}`}
              >
                {icon}
              </span>
              <span
                className={tw`font-normal ${COLOR_VARIANTS[variant].core.text}`}
              >
                {title}
              </span>
            </a>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
