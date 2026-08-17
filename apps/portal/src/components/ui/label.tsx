import * as LabelPrimitive from '@radix-ui/react-label'
import { InfoIcon } from 'lucide-react'
import type * as React from 'react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'

interface LabelProps extends React.ComponentProps<typeof LabelPrimitive.Root> {
  info?: string
}

function Label({ info, className, ...props }: LabelProps) {
  return (
    <div className="flex items-center gap-2">
      {info && (
        <Tooltip>
          <TooltipTrigger asChild>
            <InfoIcon className="size-3 text-muted-foreground" />
          </TooltipTrigger>
          <TooltipContent side="top" align="center">
            {info}
          </TooltipContent>
        </Tooltip>
      )}
      <LabelPrimitive.Root
        data-slot="label"
        className={cn(
          'flex items-center gap-2 text-sm text-muted-foreground leading-none font-normal select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
          className,
        )}
        {...props}
      />
    </div>
  )
}

export { Label }
