// @ts-expect-error - defineNitroConfig is globally available but not typed
export default defineNitroConfig({
  rollupConfig: {
    external: [
      // WalletConnect depends on pino, which optionally references pino-pretty. Rollup attempts to bundle pino-pretty even though it's not required or installed, so we mark it as external to avoid bundling errors.
      'pino-pretty',
    ],
  },
})
