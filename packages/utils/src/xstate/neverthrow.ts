import type { ResultAsync } from 'neverthrow'
import {
  type ActorRefFromLogic,
  type ActorSystem,
  type EventObject,
  fromPromise,
  type NonReducibleUnknown,
  type PromiseActorLogic,
} from 'xstate'

/**
 * An actor logic creator which returns promise logic that wraps a neverthrow ResultAsync program.
 * This allows integrating ResultAsync programs with XState actors while maintaining
 * proper error handling using neverthrow's ResultAsync.
 *
 * Actors created from resultAsync actor logic can:
 *
 * - Emit events during execution
 * - Output the result of the ResultAsync program as the actor's output value
 * - Properly handle ResultAsync errors and interruptions
 *
 * Sending events to resultAsync actors will have no effect.
 *
 * @example
 *
 * ```ts
 * import { okAsync, errAsync, ResultAsync } from 'neverthrow';
 * import { createActor } from 'xstate';
 * import { fromResultAsync } from './fromResultAsync';
 *
 * // Example async function returning ResultAsync
 * function fetchData(url: string): ResultAsync<any, Error> {
 *   return ResultAsync.fromPromise(
 *     fetch(url).then(res => res.json()),
 *     (e) => new Error('Failed to fetch: ' + String(e))
 *   );
 * }
 *
 * const fetchLogic = fromResultAsync((input: string, { emit }) => {
 *   return fetchData(input).map((data) => {
 *     emit({ type: 'DATA_RECEIVED', data });
 *     return data;
 *   });
 * });
 *
 * const fetchActor = createActor(fetchLogic);
 * fetchActor.subscribe((snapshot) => {
 *   console.log(snapshot);
 * });
 * fetchActor.start('https://example.com/api');
 * // => {
 * //   output: DATA_OBJ, // The data returned from fetchData on success
 * //   status: 'done',
 * //   ...
 * // }
 *
 * // If fetchData fails (ResultAsync is Err)
 * // => {
 * //   output: ERROR_OBJ, // The error returned from fetchData
 * //   status: 'error',
 * //   ...
 * // }
 * ```
 *
 * @param resultCreator A function which returns a neverthrow ResultAsync, and accepts:
 *   - `input` - Data that was provided to the effect actor
 *   - `ctx` - An object containing:
 *     - `emit` - Function to emit events during execution
 *     - `self` - The parent actor reference
 *     - `signal` - AbortSignal for cancellation
 *     - `system` - The actor system to which the result actor belongs
 */
export const fromResultAsync = <
  A,
  E,
  TInput = NonReducibleUnknown,
  TEmitted extends EventObject = EventObject,
>(
  resultCreator: (
    input: TInput,
    ctx: {
      emit: (event: TEmitted) => void
      self: ActorRefFromLogic<
        PromiseActorLogic<A, NoInfer<TInput>, NoInfer<TEmitted>, E>
      >
      signal: AbortSignal
      /** The actor system to which the promise actor belongs */
      // biome-ignore lint/suspicious/noExplicitAny: Can be any actor system
      system: ActorSystem<any>
    },
  ) => ResultAsync<A, E>,
) =>
  fromPromise<A, TInput, EventObject, E>(
    ({ input, emit, self, signal, system }) =>
      resultCreator(input, {
        emit,
        self: self as ActorRefFromLogic<
          PromiseActorLogic<A, NoInfer<TInput>, NoInfer<TEmitted>, E>
        >,
        signal,
        system,
      }).match(
        (value) => value,
        (error) => {
          throw error
        },
      ),
  )
