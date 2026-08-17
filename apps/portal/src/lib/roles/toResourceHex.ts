export const toResourceHex = (value: bigint): string =>
  `0x${value.toString(16).padStart(64, '0')}`
