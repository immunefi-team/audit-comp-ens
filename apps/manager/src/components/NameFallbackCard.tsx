import { Trans } from '@lingui/react/macro'
import { Link } from '@tanstack/react-router'
import { MSymbol } from '@/components/ui/material-symbol'
import { cn } from '@/lib/utils'

const DNS_TLD_DOCS_URL = 'https://docs.ens.domains/dns/tlds/'

// Beyond this the 20px nameplate can't fit the card on one line; the design
// switches to a full-width 12px multi-line nameplate stacked above the text.
const LONG_NAME_THRESHOLD = 32

export type NameFallbackReason =
  | 'unsupported-tld'
  | 'too-short'
  | 'not-found'
  | 'not-imported'

/**
 * Shown instead of a profile/registration flow for names the app can't
 * display or register: unsupported TLDs, labels too short to register,
 * nonexistent subnames, and unimported DNS names.
 */
export const NameFallbackCard = ({
  name,
  reason,
}: {
  readonly name: string
  readonly reason: NameFallbackReason
}) => {
  const isLongName = name.length > LONG_NAME_THRESHOLD

  return (
    <div
      className={cn(
        'mx-auto mt-24 max-w-md rounded-lg border-[#dededf] border-[0.25px] bg-white p-6 shadow-[0px_21px_28px_0px_rgba(14,61,104,0.06)]',
        isLongName ? 'w-full' : 'w-fit',
      )}
    >
      <div
        className={cn(
          'flex flex-col items-center',
          isLongName ? 'gap-8' : 'gap-12',
        )}
      >
        <div className="flex w-full flex-col items-center gap-3">
          <span
            className={cn(
              'wrap-anywhere rounded-[3px] bg-ens-lapis-500 p-2 font-medium font-semi-mono text-ens-white leading-ens-none tracking-tight',
              isLongName ? 'w-full text-xs' : 'text-center text-xl',
            )}
          >
            {name}
          </span>
          <span className="flex items-center gap-1 text-xl leading-ens-none tracking-tight">
            {reason === 'unsupported-tld' && (
              <>
                <Trans>uses an unsupported TLD</Trans>
                <a
                  aria-label="Supported TLD documentation"
                  href={DNS_TLD_DOCS_URL}
                  rel="noreferrer"
                  target="_blank"
                >
                  <MSymbol
                    className="ms-opsz-20 text-ens-lapis-500"
                    symbol="info"
                  />
                </a>
              </>
            )}
            {reason === 'too-short' && <Trans>is too short to register</Trans>}
            {reason === 'not-found' && <Trans>doesn't exist</Trans>}
            {reason === 'not-imported' && (
              <Trans>hasn't been imported to ENS yet</Trans>
            )}
          </span>
        </div>
        <Link
          className="flex h-13 items-center justify-center gap-2.5 rounded bg-ens-lapis-100 px-6 font-medium font-mono text-[13px] text-ens-lapis-500 uppercase tracking-[1.56px]"
          to="/dashboard"
        >
          <MSymbol className="ms-opsz-20" symbol="undo" />
          <Trans>Return to Dashboard</Trans>
        </Link>
      </div>
    </div>
  )
}
