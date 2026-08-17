const preflightTimeoutError = (ms: number): Error =>
  Object.assign(new Error(`Pre-flight RPC call timed out after ${ms}ms`), {
    name: 'PreflightTimeoutError',
    timeoutMs: ms,
  })

export const withTimeout = async <T>(
  promise: Promise<T>,
  ms: number,
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(preflightTimeoutError(ms)), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
