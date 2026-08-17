import type { ActorRefFrom, EventFrom, StateValueFrom } from 'xstate'
import type { transactionMachine } from './transaction.machine'

export type TransactionMachineState = StateValueFrom<typeof transactionMachine>
export type TransactionMachineEvent = EventFrom<typeof transactionMachine>
export type TransactionMachineActor = ActorRefFrom<typeof transactionMachine>
