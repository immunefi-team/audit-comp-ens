import type { GetRecordsReturnType } from '@ensdomains/ensjs/public'
import { useMemo } from 'react'
import type { Address } from 'viem'
import { CardsStackIcon } from '@/assets/icons'
import { DataBlockCard } from '@/features/dashboard/components'
import { recordsToTableData } from '@/utils/records/recordsToTableData'

export const RecordCount = ({
  name,
  records,
}: {
  name: string
  records?: GetRecordsReturnType
  resolverAddress: Address
}) => {
  const recordCount = useMemo(() => {
    if (records) return recordsToTableData(records).length
    else return 0
  }, [records])

  return (
    <DataBlockCard
      to="/$name/records"
      params={{ name }}
      icon={CardsStackIcon}
      label="Records set"
      value={recordCount}
    />
  )
}
