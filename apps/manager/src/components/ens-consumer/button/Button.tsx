import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  [
    // layout & reset
    'group/button inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap transition-all',
    'border border-transparent bg-clip-padding outline-none',
    'uppercase',
    // icon alignment
    "[--default-ms-optical-size:16] [&_svg,&_.material-symbol]:pointer-events-none [&_svg,&_.material-symbol]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      // Variants should primarily target color schemes
      color: {
        /**
         * For use with custom coloring
         *
         * Should define bg and text color for hover, active, disabled, and loading states
         */
        none: '',
        blue: 'bg-ens-lapis-core text-ens-white hover:bg-[#026B9C] active:bg-[#024B6E] disabled:bg-[#EDEDED] disabled:text-[#7D7D7D] disabled:opacity-100 data-loading:bg-[#026B9C]',
        lightBlue:
          'bg-[#A9D5ED] text-ens-lapis-dense hover:bg-[#79B1D0] active:bg-[#649EBE] disabled:bg-[#EDEDED] disabled:text-[#7D7D7D] disabled:opacity-100 data-loading:bg-[#79B1D0]',
        /** @experimental Not yet defined in the Design System */
        'temp-light-gray':
          'bg-ens-quartz-50 text-ens-quartz-500 hover:bg-ens-quartz-100 active:bg-ens-quartz-100 disabled:bg-ens-quartz-50 disabled:text-ens-quartz-350 disabled:opacity-100 data-loading:bg-ens-quartz-100',
        /** @experimental Not yet defined in the Design System */
        'temp-light-gray-ghost':
          'bg-transparent text-ens-quartz-400 hover:bg-ens-quartz-50 hover:text-ens-quartz-500 active:bg-ens-quartz-100 disabled:opacity-50 data-loading:bg-ens-quartz-100',
      },
      // Sizes should primarily target size, spacing, font, border-radius, etc.
      /**
       *
       * useful to define `has-data-[icon=inline-end]:pr-X has-data-[icon=inline-start]:pl-X` if custom padding for icons is needed
       */
      size: {
        /**
         * For custom sizing
         *
         * Should define padding, font-size, border-radius, etc.
         */
        none: '',
        lg: 'rounded p-6.5 text-sm',
        sm: 'rounded p-5 text-sm',
        /** @experimental Not yet defined in the Design System */
        'temp-xs': 'gap-2 rounded px-4 py-3 text-sm',
        /** @experimental Not yet defined in the Design System */
        'temp-xxs': 'gap-2 rounded px-3 py-1.5 text-sm',
      },
    },
    defaultVariants: {
      color: 'blue',
      size: 'lg',
    },
  },
)

export interface ButtonProps
  extends ButtonPrimitive.Props,
    VariantProps<typeof buttonVariants> {
  /** Purely a stylistic variable, icon should be added manually */
  loading?: boolean
}

function Button({
  className,
  color = 'blue',
  size = 'lg',
  loading,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      className={cn(buttonVariants({ color, size, className }))}
      data-loading={loading || undefined}
      data-slot="button"
      {...props}
    />
  )
}

export { Button, buttonVariants }
