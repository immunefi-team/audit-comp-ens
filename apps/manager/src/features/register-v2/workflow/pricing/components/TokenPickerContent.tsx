import {
  type SUPPORTED_TOKEN,
  TOKENS,
} from '@ens-apps/transaction-manager/contracts/ens-sepolia'
import { Trans, useLingui } from '@lingui/react/macro'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useSelector } from '@xstate/react'
import { type ReactNode, useState } from 'react'
import { match, P } from 'ts-pattern'
import { isAddressEqual } from 'viem'
import { USDCIcon } from '@/components/atoms/StableCoinsIcons'
import { DomainAttributePill } from '@/components/molecules/DomainResultCard/DomainAttributePill'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { profileReverseNameQuery } from '@/features/profile/service/profileReverseName'
import { ownedNamesCountQueryOptions } from '@/features/shared/service/ownedNamesCount'
import type { StablecoinBalance } from '@/lib/smart-account'
import { useSmartAccountContext } from '@/lib/smart-account/SmartAccountContext'
import { HCA_PAYMENT_TOKEN } from '@/lib/smart-account/useSmartAccountBalances'
import { cn } from '@/lib/utils'
import { decimalBigintToNumber } from '@/utils/formatting/decimalBigintToNumber'
import { getRegistrationV2AvailabilityQueryOptions } from '../../../data/queries/availability.query'
import { getHcaBudgetQueryOptions } from '../../../data/queries/hcaBudget.query'
import { getRegisterPriceQueryOptions } from '../../../data/queries/pricing.query'
import { getManagerRegistrationPostRegistrationSetup } from '../../../state/registrationAutoSetup'
import { useRegistrationV2Context } from '../../../state/registrationUi.context'
import { useAutoSelectOnlyToken } from '../hooks/useAutoSelectOnlyToken'
import { getPremiumLabel } from '../lib/premiumLabel'
import { computeRegistrationFunding } from '../lib/registrationFunding'
import { NetworkCostRow } from './NetworkCostRow'
import { PaymentTotalRow } from './PaymentTotalRow'
import { PriceCooldownPill } from './PriceCooldownPill'
import { TokenListItem } from './TokenListItem'

const MEDIUM_NAME_CHAR_THRESHOLD = 10
const LONG_NAME_CHAR_THRESHOLD = 43

const USDC_DECIMALS = TOKENS.USDC.decimals

/** Raised when the wallet cannot cover the funding budget. */
class InsufficientFundingError extends Error {
  constructor(
    readonly required: number,
    readonly available: number,
  ) {
    super('Insufficient USDC to fund the registration')
    this.name = 'InsufficientFundingError'
  }
}

/**
 * What the wallet is actually debited, itemised — `rent + networkFee` on the
 * standalone-HCA route. See {@link computeRegistrationFunding}.
 */
export type RegistrationFundingSummary = {
  networkFee: number
  /** What the registration costs — the figure shown on the total row. */
  total: number
  /**
   * What the wallet must hold: `total` less anything the HCA already carries.
   * This, not `total`, is what the affordability gates compare against.
   */
  walletDebit: number
  isLoading: boolean
}

const getDomainSizeClasses = (domainName: string): string => {
  const charCount = Array.from(domainName).length
  if (charCount > LONG_NAME_CHAR_THRESHOLD) return 'text-[22px]'
  if (charCount >= MEDIUM_NAME_CHAR_THRESHOLD) return 'text-[32px]'
  return 'text-[40px]'
}

export const TokenPickerContent = () => {
  const { t } = useLingui()
  const { label, uiActor } = useRegistrationV2Context()
  const account = useSmartAccountContext()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const domainName = `${label}.eth`
  const [duration, selectedToken] = useSelector(
    uiActor,
    (state) => [state.context.duration, state.context.selectedToken] as const,
  )
  const pricingQuery = useQuery({
    ...getRegisterPriceQueryOptions(
      label,
      duration,
      selectedToken ?? TOKENS.USDC.symbol,
    ),
    enabled: selectedToken !== undefined,
    select: (data) => ({
      basePriceNumber: decimalBigintToNumber(
        data.basePrice,
        selectedToken ? TOKENS[selectedToken].decimals : TOKENS.USDC.decimals,
      ),
      premiumPriceNumber: decimalBigintToNumber(
        data.premium,
        selectedToken ? TOKENS[selectedToken].decimals : TOKENS.USDC.decimals,
      ),
      totalPriceNumber: decimalBigintToNumber(
        data.basePrice + data.premium,
        selectedToken ? TOKENS[selectedToken].decimals : TOKENS.USDC.decimals,
      ),
      rawPrice: data.basePrice + data.premium,
    }),
  })

  const onSelectCoin = (coin: SUPPORTED_TOKEN) => {
    uiActor.send({ type: 'pricing.token.select', token: coin })
  }

  // The wallet's USDC balance. This is the EOA owner's balance (see
  // `useSmartAccountBalances`), which is the account the funding permit debits.
  //
  // Matched on {@link HCA_PAYMENT_TOKEN} — the manifest funding token, and the
  // same constant the balance list is built from, so the two cannot drift into
  // a lookup that never matches and reads as "no balance".
  const usdcBalanceRaw = (() => {
    const entry = account.stablecoinBalances.find((balance) =>
      isAddressEqual(balance.address, HCA_PAYMENT_TOKEN),
    )
    return entry ? BigInt(entry.balance) : null
  })()

  // Eligibility lookups run in the background (best-effort): they only seed the
  // default state of the primary-name toggle, so a slow/failed indexer never
  // blocks starting the registration.
  const existingPrimaryNameQuery = useQuery(
    profileReverseNameQuery(account.ownerAddress ?? undefined),
  )
  const ownedNamesCountQuery = useQuery(
    ownedNamesCountQueryOptions(account.ownerAddress ?? undefined),
  )

  // Auto-set is the default only when the wallet is eligible (no primary name
  // yet and fewer than 5 owned names). The user can always override via the
  // toggle, including turning it on to replace an existing primary name.
  const defaultSetAsPrimary = !!getManagerRegistrationPostRegistrationSetup({
    ownerAddress: account.ownerAddress,
    existingPrimaryName: existingPrimaryNameQuery.data,
    ownedNamesCount: ownedNamesCountQuery.data,
  })
  const [setPrimaryChoice, setSetPrimaryChoice] = useState<boolean | null>(null)
  const setAsPrimary = setPrimaryChoice ?? defaultSetAsPrimary

  // Quoted AFTER the toggle resolves, because the opt-in is priced in: it adds
  // a call to the reveal leg and widens that leg's gas limit, and the rail
  // prices the intent purely on gas units. Mirrors what
  // `registrationUi.machine.ts` hands the machine for `START_REGISTRATION`, so
  // the figure on this screen is the one the permit is sized from. Quoting
  // without it under-funds and the permit preflight then rejects a wallet this
  // screen just told the user was sufficient.
  const budgetQueryOptions = getHcaBudgetQueryOptions({
    label,
    durationInSeconds: duration,
    hca: account.accountAddress,
    signer: account.signer,
    primaryName: setAsPrimary ? domainName : undefined,
    getSessionEnablePayload: account.getSessionEnablePayload,
  })
  const budgetQuery = useQuery(budgetQueryOptions)

  // Absent until the quote lands, and permanently absent if it fails — in which
  // case the screen falls back to showing the rent alone rather than blocking
  // on a flaky quote.
  const funding = computeRegistrationFunding({
    budget: budgetQuery.data,
    walletBalanceRaw: usdcBalanceRaw,
    ...(budgetQuery.data ? { hcaBalanceRaw: budgetQuery.data.hcaBalance } : {}),
    decimals: USDC_DECIMALS,
  })

  // An explicit toggle choice always wins. Otherwise resolve the eligibility
  // lookups (already in flight for the toggle default — fetchQuery dedupes)
  // so a click that lands before they settle still auto-sets correctly. A
  // failed lookup skips the auto-setup rather than blocking registration.
  const resolveSetAsPrimary = async (): Promise<boolean> => {
    if (setPrimaryChoice !== null) return setPrimaryChoice
    if (!account.ownerAddress) return false
    try {
      const [existingPrimaryName, ownedNamesCount] = await Promise.all([
        queryClient.fetchQuery(profileReverseNameQuery(account.ownerAddress)),
        queryClient.fetchQuery(
          ownedNamesCountQueryOptions(account.ownerAddress),
        ),
      ])
      return !!getManagerRegistrationPostRegistrationSetup({
        ownerAddress: account.ownerAddress,
        existingPrimaryName,
        ownedNamesCount,
      })
    } catch {
      return false
    }
  }

  // Dispatch `registration.start`. The smart-session gate runs UP FRONT (in
  // PaymentCard, before this chooser opens), so on the HCA path a session is
  // already active here and `account.signer` carries it — no signer override
  // or enable prompt is needed at this step.
  const startRegistration = async (resolvedSetAsPrimary: boolean) => {
    if (!pricingQuery.data || !selectedToken) return
    // Resolve the session-enable payload up front (checks on-chain enablement).
    const hcaSessionEnable = await account.getSessionEnablePayload()
    uiActor.send({
      type: 'registration.start',
      label,
      duration: BigInt(Math.ceil(duration)),
      token: selectedToken,
      totalPrice: pricingQuery.data.rawPrice,
      account,
      hcaSessionEnable,
      basePriceNumber: pricingQuery.data.basePriceNumber,
      premiumPriceNumber: pricingQuery.data.premiumPriceNumber,
      postRegistrationSetup: resolvedSetAsPrimary
        ? { primaryName: { enabled: true, syncEthRecord: true } }
        : undefined,
    })
  }

  const availabilityMutation = useMutation({
    mutationFn: async () => {
      // Re-check funding on the click path, not just on render: the quote may
      // still have been in flight when the screen painted, and a stale budget
      // would let through exactly the registration this gate exists to stop.
      // `fetchQuery` reuses the in-flight/fresh result, so this is usually free.
      const budget = await queryClient
        .fetchQuery(budgetQueryOptions)
        // A quote failure is not a funding failure. Fall through and let the
        // machine (and its own pre-permit balance check) surface the problem.
        .catch(() => null)

      // Against the shortfall, not the budget: the permit tops the HCA up to
      // the budget, so an HCA still holding USDC from a prior registration
      // covers part of it and the wallet is debited only the difference.
      const walletDebitRaw = budget
        ? budget.total > budget.hcaBalance
          ? budget.total - budget.hcaBalance
          : 0n
        : null

      if (
        walletDebitRaw !== null &&
        usdcBalanceRaw !== null &&
        usdcBalanceRaw < walletDebitRaw
      ) {
        throw new InsufficientFundingError(
          decimalBigintToNumber(walletDebitRaw, USDC_DECIMALS),
          decimalBigintToNumber(usdcBalanceRaw, USDC_DECIMALS),
        )
      }

      const [availability, resolvedSetAsPrimary] = await Promise.all([
        queryClient.fetchQuery({
          ...getRegistrationV2AvailabilityQueryOptions(`${label}.eth`),
          staleTime: 0,
        }),
        resolveSetAsPrimary(),
      ])
      return { availability, resolvedSetAsPrimary }
    },
    onSuccess: async ({ availability, resolvedSetAsPrimary }) => {
      if (!pricingQuery.data || !selectedToken) return

      if (!availability.isAvailable) {
        navigate({
          replace: true,
          to: '/$name',
          params: { name: `${label}.eth` },
        })
        return
      }

      await startRegistration(resolvedSetAsPrimary)
    },
  })

  const { stablecoinBalances, isLoadingBalances, isConnected } =
    useSmartAccountContext()

  // Prefer the funding shortfall over the generic availability copy: it is the
  // more specific failure and the only one the user can act on directly.
  //
  // The headline figure is always the DEBIT — with a part-funded HCA the wallet
  // owes less than the registration costs, and quoting the budget would name a
  // figure the user does not have to hold. The itemisation has to follow suit:
  // `registration + networkFee` sums to the TOTAL, so spelling it out next to a
  // credited debit prints two different numbers for the same quantity. Only the
  // uncredited case itemises; the credited one names the credit instead, which
  // is what reconciles the two.
  const errorMessage = match({
    funding,
    mutationError: availabilityMutation.error,
    isAvailabilityError: availabilityMutation.isError,
  })
    .with(
      { funding: { isUnderfunded: true, hcaCredit: P.number.gt(0) } },
      ({ funding: f }) =>
        t`Not enough USDC. This registration costs ${f.total.toFixed(2)} USDC and your account already holds ${f.hcaCredit.toFixed(2)}, so you need ${f.walletDebit.toFixed(2)} more — but your wallet holds ${(f.walletBalance ?? 0).toFixed(2)} USDC.`,
    )
    .with(
      { funding: { isUnderfunded: true } },
      ({ funding: f }) =>
        t`Not enough USDC. This registration needs ${f.walletDebit.toFixed(2)} USDC — a ${f.registration.toFixed(2)} registration plus a ${f.networkFee.toFixed(2)} network cost — but your wallet holds ${(f.walletBalance ?? 0).toFixed(2)} USDC.`,
    )
    .with(
      { mutationError: P.instanceOf(InsufficientFundingError) },
      ({ mutationError: e }) =>
        t`Not enough USDC. This registration needs ${e.required.toFixed(2)} USDC but your wallet holds ${e.available.toFixed(2)} USDC.`,
    )
    .with(
      { isAvailabilityError: true },
      () =>
        t`We couldn't confirm that ${domainName} is still available. Please try again.`,
    )
    .otherwise(() => null)

  return (
    <TokenPickerContentBase
      errorMessage={errorMessage}
      footer={
        <div className="flex w-full items-center justify-between gap-3 rounded-xl bg-[rgb(250,250,250)] px-4 py-3 text-left">
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-ens-gray text-sm">
              <Trans>Set as primary name</Trans>
            </span>
            <span className="text-ens-gray text-xs">
              <Trans>
                Your wallet address can only have one primary name, which will
                display instead of your wallet address across apps. You'll be
                prompted to confirm this additional transaction after
                registration.
              </Trans>
            </span>
          </div>
          <Switch
            aria-label={t`Set ${domainName} as your primary name`}
            checked={setAsPrimary}
            onCheckedChange={setSetPrimaryChoice}
          />
        </div>
      }
      funding={
        funding
          ? {
              networkFee: funding.networkFee,
              total: funding.total,
              walletDebit: funding.walletDebit,
              isLoading: budgetQuery.isFetching,
            }
          : undefined
      }
      isConnected={isConnected}
      isInPriceCooldown={(pricingQuery.data?.premiumPriceNumber ?? 0) > 0}
      isLoadingBalances={isLoadingBalances}
      isQuotingFunding={budgetQuery.isLoading}
      label={label}
      onNext={() => availabilityMutation.mutate()}
      onSelectCoin={onSelectCoin}
      pricingData={pricingQuery.data?.totalPriceNumber}
      pricingLoading={pricingQuery.isLoading}
      selectedToken={selectedToken}
      stablecoinBalances={stablecoinBalances}
    />
  )
}

export const TokenPickerContentBase = ({
  label,
  pricingLoading,
  pricingData,
  isInPriceCooldown = false,
  selectedToken,
  errorMessage,
  onSelectCoin,
  onNext,
  stablecoinBalances,
  isLoadingBalances,
  isConnected,
  nextMessage = <Trans>Register name</Trans>,
  footer,
  funding,
  isQuotingFunding = false,
}: {
  label: string
  pricingLoading: boolean
  pricingData: number | undefined
  isInPriceCooldown?: boolean
  selectedToken: SUPPORTED_TOKEN | undefined
  errorMessage?: string | null
  onSelectCoin: (coin: SUPPORTED_TOKEN) => void
  onNext: () => void
  stablecoinBalances: StablecoinBalance[]
  isLoadingBalances: boolean
  isConnected: boolean
  nextMessage?: ReactNode
  /** Optional content below the payment options (e.g. the primary-name toggle). */
  footer?: ReactNode
  /**
   * Itemises the funding budget when the wallet is debited more than the rent —
   * the standalone-HCA route funds both on-chain legs from the same transfer.
   * Absent until the quote lands, and for routes that have no budget to quote
   * (a pure-EOA signer pays the registrar directly). When present, `total` —
   * not `pricingData` — is what the wallet must cover.
   */
  funding?: RegistrationFundingSummary
  /**
   * The budget quote is still in flight. Reserves the network-cost row's space
   * so the token list below it does not jump once the quote lands — two
   * orchestrator round-trips is long enough for that shift to be felt.
   */
  isQuotingFunding?: boolean
}) => {
  const { t } = useLingui()
  const domainName = `${label}.eth`
  const premiumLabel = getPremiumLabel(label.length)

  const hasBalances = (stablecoinBalances?.length || 0) > 0

  useAutoSelectOnlyToken({
    isLoadingBalances,
    onSelectCoin,
    selectedToken,
    stablecoinBalances,
  })

  // Gate on the funded amount, never the rent alone: the permit is signed for
  // `rent + networkFee`, so a wallet holding only the rent cannot pay. It is
  // the wallet's DEBIT rather than the budget, since a part-funded HCA covers
  // the remainder itself — gating on the budget would block a wallet that only
  // owes the shortfall.
  const requiredAmount = funding?.walletDebit ?? pricingData

  // What the registration costs, shown on the total row. Diverges from
  // `requiredAmount` only when the HCA is already carrying USDC.
  const displayTotal = funding?.total ?? pricingData

  const selectedCoinBalance = stablecoinBalances?.find(
    (coin) => coin.symbol === selectedToken,
  )

  // Tested for presence, never truthiness: a debit of 0 is a legitimate state,
  // not a missing quote. An HCA already holding the whole budget — an aborted
  // registration that funded the commit but never revealed — owes the wallet
  // nothing, and a falsy 0 would block exactly the retry that should sail
  // through.
  const hasSufficientBalanceForSelectedCoin =
    selectedCoinBalance !== undefined &&
    requiredAmount !== undefined &&
    decimalBigintToNumber(
      BigInt(selectedCoinBalance.balance),
      selectedCoinBalance.decimals,
    ) >= requiredAmount

  const canNext =
    isConnected &&
    !!selectedToken &&
    !pricingLoading &&
    hasBalances &&
    hasSufficientBalanceForSelectedCoin

  return (
    <div className="flex h-full flex-1 flex-col gap-6 px-4 pt-2 pb-6">
      <div className="flex flex-1 flex-col items-center gap-8 overflow-y-auto">
        <div className="flex w-full min-w-0 flex-col items-center gap-4 rounded-2xl bg-ens-quartz-50 p-6">
          {(premiumLabel || isInPriceCooldown) && (
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
              {premiumLabel && (
                <DomainAttributePill
                  label={t(premiumLabel.label)}
                  variant={premiumLabel.variant}
                />
              )}
              {isInPriceCooldown && <PriceCooldownPill />}
            </div>
          )}
          <span
            className={cn(
              'wrap-anywhere w-full min-w-0 text-center font-medium font-semi-mono',
              'whitespace-normal leading-ens-none tracking-[-0.8px]',
              'text-ens-gray',
              getDomainSizeClasses(domainName),
            )}
            title={domainName}
          >
            {domainName}
          </span>

          {(funding || isQuotingFunding) && (
            <NetworkCostRow
              isLoading={funding?.isLoading ?? true}
              networkFee={funding?.networkFee}
            />
          )}
        </div>

        <div className="flex w-full flex-col gap-6">
          <h2 className="text-center font-medium text-[18px] leading-ens-none">
            <Trans>Select payment</Trans>
          </h2>
          {match({
            isLoadingBalances,
            hasBalances,
            stablecoinsCount: stablecoinBalances?.length ?? 0,
            isConnected,
            pricingLoading,
          })
            .with({ isConnected: false }, () => (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-2 text-ens-gray text-sm">
                  <Trans>Please connect your wallet first</Trans>
                </div>
                <div className="text-ens-gray-three text-xs">
                  <Trans>
                    You need to connect a wallet to see your stablecoin balances
                  </Trans>
                </div>
              </div>
            ))
            .with({ isLoadingBalances: true }, () => (
              <div className="flex items-center justify-center py-8">
                <div className="text-ens-gray-two text-sm">
                  <Trans>Loading your stablecoin balances...</Trans>
                </div>
              </div>
            ))
            .with({ pricingLoading: true }, () => (
              <div className="flex items-center justify-center py-8">
                <div className="text-ens-gray-two text-sm">
                  <Trans>Loading pricing...</Trans>
                </div>
              </div>
            ))
            .with({ stablecoinsCount: 0 }, () => (
              <div className="flex items-center justify-center py-8">
                <div className="text-ens-gray-two text-sm">
                  <Trans>No stablecoins available</Trans>
                </div>
              </div>
            ))
            .with({ stablecoinsCount: P.number.gt(0) }, () => (
              <div className="flex max-h-56 flex-col gap-3 overflow-y-auto pr-1">
                {stablecoinBalances.map((stablecoin) => (
                  <TokenListItem
                    key={stablecoin.address}
                    onSelectCoin={onSelectCoin}
                    priceUSD={requiredAmount ?? 0}
                    selectedCoin={selectedToken}
                    stablecoin={stablecoin}
                  />
                ))}
              </div>
            ))
            .otherwise(() => undefined)}

          {errorMessage && (
            <p className="text-center text-ens-error text-sm">{errorMessage}</p>
          )}

          <div className="flex flex-col items-center gap-1.5">
            <p className="text-center font-normal text-ens-gray text-xs tracking-tight">
              <Trans>Stables accepted</Trans>
            </p>
            <div className="flex items-center gap-1">
              <USDCIcon className="h-7 w-7" />
            </div>
          </div>

          {footer}
        </div>
      </div>

      <PaymentTotalRow isEstimate={!!funding} total={displayTotal} />

      <Button
        className={cn(
          'h-20 w-full rounded bg-ens-gray-two font-medium font-mono text-ens-gray-dark text-sm uppercase tracking-wider',
          'hover:bg-ens-gray-two',
          'disabled:cursor-not-allowed disabled:opacity-50',
          canNext && 'bg-ens-blue text-white hover:bg-ens-blue-hover',
        )}
        disabled={!canNext}
        onClick={onNext}
      >
        {nextMessage}
      </Button>
    </div>
  )
}
