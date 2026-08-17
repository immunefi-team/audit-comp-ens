type DefaultExportWrapper<T> = {
  readonly default: T
}

export const resolveDefaultExport = <T>(
  value: T | DefaultExportWrapper<T>,
): T => {
  if (value && typeof value === 'object' && 'default' in value) {
    return value.default
  }

  return value
}
