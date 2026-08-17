import type { ActorRefFrom, EventFrom, StateValueFrom } from 'xstate'
import type { registrationMachine } from './registration.machine'

export type RegistrationMachineState = StateValueFrom<
  typeof registrationMachine
>
export type RegistrationMachineEvent = EventFrom<typeof registrationMachine>
export type RegistrationMachineActor = ActorRefFrom<typeof registrationMachine>
