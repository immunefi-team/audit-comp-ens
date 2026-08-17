export type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

export type DiscriminatedPayloadMapper<
  TDef extends Record<string, unknown>,
  TInput,
  TDiscriminatorKey extends keyof TInput,
  TPayloadKey extends keyof TInput,
> = Prettify<Omit<TInput, TDiscriminatorKey | TPayloadKey>> &
  {
    [K in keyof TDef]: Prettify<
      {
        [_ in TPayloadKey]: TDef[K]
      } & {
        [_ in TDiscriminatorKey]: K
      }
    >
  }[keyof TDef]

export type KindToPayload<T extends { kind: string }> = {
  [K in T as K['kind']]: Prettify<Omit<K, 'kind'>>
}
