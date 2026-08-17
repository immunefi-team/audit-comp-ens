import { match, P } from 'ts-pattern'
import { createRegistrationV2UiSelector } from './registrationUi.context'

export const useRegistrationStep = createRegistrationV2UiSelector((state) =>
  match(state.value)
    .with({ pricing: P.string }, () => 'pricing' as const)
    .with({ registering: P.any }, () => 'registering' as const)
    .with(P.string, (step) => step)
    .exhaustive(),
)

export const usePricingStep = createRegistrationV2UiSelector((state) =>
  match(state.value)
    .with({ pricing: P.string }, (step) => step.pricing)
    .otherwise(() => undefined),
)

export const useRegisteringStage = createRegistrationV2UiSelector((state) =>
  match(state.value)
    .with({ registering: P.any }, (step) => step.registering)
    .otherwise(() => undefined),
)
