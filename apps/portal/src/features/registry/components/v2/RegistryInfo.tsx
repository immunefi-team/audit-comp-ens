import { NameSubgraphHistory } from '@/components/table/NameSubgraphHistory/NameSubgraphHistory'
import type { GetEnsOwnerReturnType } from '@/features/profile/hooks/useEnsOwner'
import { RegistryHistory } from './RegistryHistory'
import { RegistryTree } from './RegistryTree'

type V2RegistryInfoProps = {
  name: string
  ownerData: NonNullable<GetEnsOwnerReturnType>
}

export function V2RegistryInfo({ name, ownerData }: V2RegistryInfoProps) {
  return (
    <section className="flex flex-col gap-8">
      <h1 className="text-h1">Registry</h1>
      <RegistryTree name={name} ownerData={ownerData} />
      {/* V1 names have no registry of their own for the indexer history to
          follow — show the name's registration history instead (WEB-693). */}
      {ownerData.protocolVersion === 'ENSv1' ? (
        <NameSubgraphHistory name={name} category="registration" />
      ) : (
        <RegistryHistory name={name} />
      )}
    </section>
  )
}
