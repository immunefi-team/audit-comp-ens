import { Layers } from 'lucide-react'
import type { MigrationStatus } from '@/features/migration/hooks/useMigrationStatus'
import type { ProtocolVersion } from '@/utils/types'
import { InfoRow } from './InfoRow'

/**
 * "Protocol" overview row. For ENSv2 names it shows the version; for ENSv1 it
 * also surfaces whether the name can be migrated to ENSv2.
 */
export const ProtocolRow = ({
  protocolVersion,
  migration,
  isLoading,
}: {
  protocolVersion: ProtocolVersion
  migration?: MigrationStatus
  isLoading?: boolean
}) => {
  const showMigrationSuffix =
    protocolVersion === 'ENSv1' && !isLoading && migration !== undefined

  return (
    <InfoRow icon={Layers} label="Protocol">
      {protocolVersion}
      {showMigrationSuffix && (
        <>
          {' : '}
          {migration.migratable ? 'Can be migrated' : 'Cannot be migrated'}
        </>
      )}
    </InfoRow>
  )
}
