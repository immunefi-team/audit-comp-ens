import { tw } from '@/utils/tailwind'

export const FilterBadge = (props: {
  active: boolean
  label: string
  size?: 'sm' | 'md'
  onClick?: () => void
}) => {
  return (
    <button
      className={tw(
        'cursor-pointer rounded-sm font-normal font-semi-mono text-sm uppercase leading-[1.05] tracking-[0.28px] transition-colors',
        props.active
          ? 'bg-[#232222] text-white'
          : 'bg-ens-white text-ens-quartz-400 hover:bg-[#f4f4f6]',
        props.size === 'sm' ? 'px-3 py-2' : 'px-4 py-3',
      )}
      onClick={props.onClick}
      type="button"
    >
      {props.label}
    </button>
  )
}
