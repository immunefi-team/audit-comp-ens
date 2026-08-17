import type { GetRecordsReturnType } from '@ensdomains/ensjs/public'
import type { NameRecord } from '@/features/records/components/RecordsTable/columns'

type Entries<T> = {
  [K in keyof T]-?: [K, T[K]]
}[keyof T][]

export const recordsToTableData = (
  records: GetRecordsReturnType,
): NameRecord[] => {
  const data: NameRecord[] = []

  for (const [key, value] of Object.entries(
    records,
  ) as Entries<GetRecordsReturnType>) {
    if (key === 'contentHash' && value) {
      data.push({
        type: key,
        value: `${value.protocolType}://${value.decoded}`,
      })
    }
    if (key === 'abi' && value) {
      // ABI can be a string or object, convert to JSON string for display
      const abiValue =
        typeof value.abi === 'string' ? value.abi : JSON.stringify(value.abi)
      data.push({
        type: 'abi',
        value: abiValue,
      })
    }
    if (key === 'texts') {
      for (const { key, value: text } of Object.values(value)) {
        data.push({ key, value: text, type: 'text' })
      }
    }
    if (key === 'coins') {
      for (const { coinType, value: addr, symbol } of Object.values(value)) {
        data.push({ key: symbol, value: addr, type: 'address', id: coinType })
      }
    }
  }

  return data
}
