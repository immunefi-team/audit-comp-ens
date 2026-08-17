const coinIconsRaw = import.meta.glob<string>('./*-icon.svg', {
  query: '?no-inline',
  eager: true,
  import: 'default',
})

// remap to keyed by coin type
export const coinIcons = Object.fromEntries(
  Object.entries(coinIconsRaw).map(([key, value]) => [
    // biome-ignore lint/style/noNonNullAssertion: always has a value
    key.split('/').pop()!.split('-')[0]!,
    value,
  ]),
)
