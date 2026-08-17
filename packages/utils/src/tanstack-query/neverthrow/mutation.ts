import type {
  MutationFunctionContext,
  OmitKeyof,
  UseMutationOptions,
  WithRequired,
} from '@tanstack/react-query'
import type { Result, ResultAsync } from 'neverthrow'
import type { ResultError } from './shared'

export type ResultMutationFunction<
  TData,
  TError extends ResultError,
  TVariables = void,
> = (
  variables: TVariables,
  context: MutationFunctionContext,
) => Result<TData, TError> | ResultAsync<TData, TError>

export type UseResultMutationOptions<
  TData,
  TError extends ResultError,
  TVariables = void,
  TOnMutateResult = unknown,
> = OmitKeyof<
  UseMutationOptions<TData, TError, TVariables, TOnMutateResult>,
  'mutationFn'
> & {
  mutationFn?: ResultMutationFunction<TData, TError, TVariables>
}

export function resultMutationOptions<
  TData,
  TError extends ResultError,
  TVariables = void,
  TOnMutateResult = unknown,
>(
  options: WithRequired<
    UseResultMutationOptions<TData, TError, TVariables, TOnMutateResult>,
    'mutationKey'
  >,
): WithRequired<
  UseMutationOptions<TData, TError, TVariables, TOnMutateResult>,
  'mutationKey'
>
export function resultMutationOptions<
  TData,
  TError extends ResultError,
  TVariables = void,
  TOnMutateResult = unknown,
>(
  options: Omit<
    UseResultMutationOptions<TData, TError, TVariables, TOnMutateResult>,
    'mutationKey'
  >,
): Omit<
  UseMutationOptions<TData, TError, TVariables, TOnMutateResult>,
  'mutationKey'
>
export function resultMutationOptions<
  TData,
  TError extends ResultError,
  TVariables,
  TOnMutateResult,
>({
  mutationFn: rawMutationFn,
  ...rest
}: UseResultMutationOptions<
  TData,
  TError,
  TVariables,
  TOnMutateResult
>): UseMutationOptions<TData, TError, TVariables, TOnMutateResult> {
  const mutationFn =
    typeof rawMutationFn === 'function'
      ? (variables: TVariables, context: MutationFunctionContext) =>
          rawMutationFn(variables, context).match(
            (value) => value,
            (error) => {
              throw error
            },
          )
      : rawMutationFn

  return {
    ...rest,
    mutationFn,
  } as UseMutationOptions<TData, TError, TVariables, TOnMutateResult>
}
