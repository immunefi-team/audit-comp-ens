import { match, P } from 'ts-pattern'
import { createRenewalUiSelector } from './renewalUi.context'

export const useRenewalStep = createRenewalUiSelector((state) =>
  match(state.value)
    .with({ pricing: P.string }, () => 'pricing' as const)
    .with(P.string, (step) => step)
    .exhaustive(),
)
