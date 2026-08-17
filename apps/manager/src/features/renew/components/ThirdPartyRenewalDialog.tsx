import { Trans, useLingui } from '@lingui/react/macro'
import type { ReactNode } from 'react'
import { Button, LinkButton } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { MSymbol } from '@/components/ui/material-symbol'
import {
  getRenewalRoute,
  type RenewalProtocol,
} from '@/features/renew/utils/renewalProtocol'

type ThirdPartyRenewalDialogProps = {
  readonly name: string
  readonly protocol: RenewalProtocol
  readonly trigger: ReactNode
}

const modalButtonClassName =
  'h-[74px] w-full rounded bg-ens-lapis-500 px-4 py-0 font-semi-mono text-sm text-ens-quartz-0 uppercase tracking-[1.12px] shadow-none hover:bg-[#026B9C] sm:w-[226px]'

export const ThirdPartyRenewalDialog = ({
  name,
  protocol,
  trigger,
}: ThirdPartyRenewalDialogProps) => {
  const { t } = useLingui()

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className="w-[calc(100%-2rem)] max-w-[520px] gap-[33px] overflow-hidden rounded-xl border-0 bg-ens-quartz-50 px-5 pt-7 pb-8 shadow-[0_4px_24.1px_rgba(7,28,47,0.07)] sm:max-w-[520px]"
        overlayClassName="bg-[rgba(120,118,118,0.5)] backdrop-blur-[6.3px]"
        showCloseButton={false}
      >
        <DialogClose asChild>
          <button
            aria-label={t`Close`}
            className="absolute top-5 right-5 flex size-5 items-center justify-center text-ens-garnet-800 transition-opacity hover:opacity-75 focus:outline-none focus-visible:outline-none"
            type="button"
          >
            <MSymbol
              className="ms-opsz-20 ms-wght-300 text-xl"
              symbol="close"
            />
          </button>
        </DialogClose>

        <div className="flex flex-col items-center text-center">
          <MSymbol
            aria-hidden="true"
            className="ms-opsz-40 ms-wght-300 text-[40px] text-ens-lapis-900"
            symbol="redeem"
          />
          <DialogTitle className="mt-6 font-normal text-2xl text-ens-lapis-900 leading-5">
            <Trans>That's generous of you!</Trans>
          </DialogTitle>
          <DialogDescription className="mt-7 max-w-[411px] text-base text-ens-quartz-500 leading-5">
            <Trans>
              Renewing this name will add time to the <em>current owner's</em>{' '}
              registration. You won't gain ownership of the name, but you will
              make someone's day.
            </Trans>
          </DialogDescription>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <DialogClose asChild>
            <Button
              className="h-[74px] w-full rounded bg-[#E2E8F0] px-4 py-0 font-semi-mono text-ens-lapis-500 text-sm uppercase tracking-[1.12px] shadow-none hover:bg-[#d8e0eb] sm:w-[226px]"
              type="button"
            >
              <Trans>Cancel</Trans>
            </Button>
          </DialogClose>
          <LinkButton
            className={modalButtonClassName}
            params={{ name }}
            to={getRenewalRoute(protocol)}
          >
            <Trans>I Understand</Trans>
          </LinkButton>
        </div>
      </DialogContent>
    </Dialog>
  )
}
