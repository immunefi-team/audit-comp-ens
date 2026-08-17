import { fromResultAsync } from '@ens-apps/utils/xstate/neverthrow'
import { err, ok, type Result } from 'neverthrow'
import type { Hex, SendTransactionRequest, TransactionReceipt } from 'viem'
import { assign, log, setup } from 'xstate'
import { type ChainType, wagmiConfig } from '@/lib/wagmi'
import {
  safeSendTransaction,
  safeWaitForTransactionReceipt,
  type WagmiSendTransactionError,
  type WagmiWaitForTransactionReceiptError,
} from '@/lib/wagmi/helpers'

export type TransactionMachineError =
  | WagmiSendTransactionError
  | WagmiWaitForTransactionReceiptError

export type TransactionMachineResult = Result<
  TransactionReceipt,
  TransactionMachineError
>

export const transactionMachine = setup({
  types: {
    context: {} as {
      transactionRequest: SendTransactionRequest<ChainType>
      transactionHash?: Hex
      receipt?: TransactionReceipt
      error?: TransactionMachineError
    },
    input: {} as {
      transactionRequest: SendTransactionRequest<ChainType>
    },
    output: {} as TransactionMachineResult,
  },
  actors: {
    sendTransaction: fromResultAsync(
      ({
        tranactionRequest,
      }: {
        tranactionRequest: SendTransactionRequest<ChainType>
      }) => safeSendTransaction(wagmiConfig, tranactionRequest),
    ),
    waitForReceipt: fromResultAsync(
      ({ transactionHash }: { transactionHash: Hex }) =>
        safeWaitForTransactionReceipt(wagmiConfig, { hash: transactionHash }),
    ),
  },
}).createMachine({
  context: ({ input }) => ({
    transactionRequest: input.transactionRequest,
  }),
  id: 'TransactionFlow',
  initial: 'Submitting',
  states: {
    Submitting: {
      invoke: {
        input: ({ context }) => ({
          tranactionRequest: context.transactionRequest,
        }),
        src: 'sendTransaction',
        id: 'sendTransaction',
        onDone: {
          target: 'Pending',
          actions: [
            assign({
              transactionHash: ({ event }) => event.output,
            }),
            log(({ event }) => `Transaction sent: ${event.output}`),
          ],
        },
        onError: {
          target: 'Error',
          actions: [
            assign({ error: ({ event }) => event.error }),
            log(({ event }) => `Transaction failed to send: ${event.error}`),
          ],
        },
      },
    },
    Pending: {
      invoke: {
        src: 'waitForReceipt',
        input: ({ context }) => ({
          // biome-ignore lint/style/noNonNullAssertion: guaranteed by machine state
          transactionHash: context.transactionHash!,
        }),
        onDone: {
          target: 'Success',
          actions: [assign({ receipt: ({ event }) => event.output })],
        },
        onError: {
          target: 'Error',
          actions: [assign({ error: ({ event }) => event.error })],
        },
      },
    },
    Success: {
      type: 'final',
      // biome-ignore lint/style/noNonNullAssertion: guaranteed by machine state
      output: ({ context }) => ok(context.receipt!),
    },
    Error: {
      type: 'final',
      // biome-ignore lint/style/noNonNullAssertion: guaranteed by machine state
      output: ({ context }) => err(context.error!),
    },
  },
  output: ({ event }) => event.output as TransactionMachineResult,
})
