import type { RegistrationMachineState } from '@ens-apps/transaction-manager'

type RegistrationMachineStage = Extract<RegistrationMachineState, string>

export type PostRegistrationStage =
  | 'postRegistrationSetup'
  | 'syncingEthRecord'
  | 'waitingForEthRecordSync'
  | 'settingPrimaryName'

export type RegistrationStage = RegistrationMachineStage | PostRegistrationStage

export const REGISTRATION_STAGE_PROGRESS = {
  idle: 0,
  settingUpRegistration: 5,
  // Pure-EOA spine
  deployingResolver: 8,
  waitingForResolverDeployment: 15,
  preparingCommitment: 23,
  committingTransaction: 31,
  // Standalone-HCA commit leg: size the budget → check funding → (permit) →
  // fund+enable+commit as one session-signed request. Sits alongside
  // `committingTransaction`.
  computingHcaBudget: 25,
  checkingHcaFunding: 27,
  signingFundingPermit: 29,
  submittingSetupBundle: 31,
  // Shared cooldown spine
  waitingForCommitment: 38,
  fetchingCommitmentAge: 40,
  commitmentCooldown: 44,
  validatingCommitment: 46,
  // Pure-EOA allowance + approve
  checkingAllowance: 50,
  approvingToken: 54,
  waitingForApproval: 62,
  // Pure-EOA reveal
  registeringDomain: 77,
  waitingForRegistration: 90,
  // Standalone-HCA reveal batch
  submittingRhinestoneBundle: 55,
  waitingForRhinestoneBundle: 85,
  verifyingRegistration: 95,
  postRegistrationSetup: 96,
  syncingEthRecord: 97,
  waitingForEthRecordSync: 98,
  settingPrimaryName: 99,
  success: 100,
  error: 0,
} as const satisfies Record<RegistrationStage, number>

export function getRegistrationStageProgress(stage: string): number {
  return stage in REGISTRATION_STAGE_PROGRESS
    ? REGISTRATION_STAGE_PROGRESS[stage as RegistrationStage]
    : 0
}

export type MaxProgressReached = {
  stage: RegistrationStage
  progress: number
}
