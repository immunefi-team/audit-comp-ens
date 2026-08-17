import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ExtendNameDisclaimerProps = {
  readonly onContinue: () => void
}

export const ExtendNameDisclaimer = ({
  onContinue,
}: ExtendNameDisclaimerProps) => {
  return (
    <div className="flex flex-col gap-6 items-center justify-center">
      <TriangleAlert className="size-6" />
      <p className="text-base text-center">
        Extending a name does not change the owner. Extending a name you do not
        own will not give you ownership of it.
      </p>
      <Button variant="default" className="w-full" onClick={onContinue}>
        I Understand
      </Button>
    </div>
  )
}
