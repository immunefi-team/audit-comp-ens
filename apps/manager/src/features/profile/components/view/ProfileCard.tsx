import { cn } from '@/lib/utils'

export const profileCardCopyIconClassName =
  'ml-0 size-4 shrink-0 text-ens-quartz-400 lg:landscape:size-6 lg:landscape:text-ens-quartz-700'

export const profileCardTrailingIconStrokeWidth = 1.33

export const cardSurfaceClassName =
  'rounded-[14px] border-[0.692px] border-[rgba(199,198,196,0.25)] bg-white shadow-[0_2px_6px_rgba(0,0,0,0.06)] transition hover:bg-ens-quartz-50 lg:landscape:rounded-xl lg:landscape:border-[0.25px] lg:landscape:border-ens-quartz-300'

export const valueClassName =
  'font-mono text-sm text-ens-quartz-500 leading-normal'

const profileCardClassName =
  'border-[0.25px] border-transparent bg-transparent shadow-none'

const sectionTitleClassName =
  'font-sans text-base text-ens-quartz-900 leading-normal'

export const ProfileCard = ({
  children,
  className = '',
  title,
}: {
  readonly children: React.ReactNode
  readonly className?: string
  readonly title: React.ReactNode
}) => (
  <section
    className={cn(
      profileCardClassName,
      'px-5 py-6 lg:landscape:px-8 lg:landscape:pt-8 lg:landscape:pb-6',
      className,
    )}
  >
    <h2 className={sectionTitleClassName}>{title}</h2>
    <div className="mt-6">{children}</div>
  </section>
)
