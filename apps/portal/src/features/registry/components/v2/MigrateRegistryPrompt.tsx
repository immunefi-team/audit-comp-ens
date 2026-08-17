import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getMigrationStatusQueryOptions } from '@/features/migration/hooks/useMigrationStatus'
import { useIsMobile } from '@/hooks/use-mobile'
import { MANAGER_APP_BASE_URL } from '@/lib/constants/domain'
import { cn } from '@/lib/utils'

const MANAGER_MIGRATE_URL = `${MANAGER_APP_BASE_URL}/migration`

/**
 * The V1 twin of ConfigureRegistryForm's empty state (WEB-693 / WEB-696): a V1
 * name can't deploy its own registry until it migrates to ENSv2, so the tree's
 * unconfigured-registry slot shows a Migrate CTA instead of the deploy form.
 *
 * Migratability is name-scoped: evaluated against the name's own V1 token
 * holder (wrappedOwner/registrant — NOT the registry controller), so the
 * prompt is visible to any visitor per the Figma, which shows it while
 * disconnected; the migration flow itself gates on the right wallet. Names
 * the classifier deems non-migratable render nothing — the tree simply ends
 * at the name row.
 */
export const MigrateRegistryPrompt = ({ name }: { readonly name: string }) => {
  const isMobile = useIsMobile()
  const { data: migration } = useQuery(getMigrationStatusQueryOptions({ name }))

  if (migration?.migratable !== true) return null

  return (
    <div
      className={cn(
        'flex flex-col gap-4 max-w-xl',
        isMobile ? 'pl-0 pt-3' : 'pl-14',
      )}
    >
      <div className="flex flex-col gap-2 bg-muted p-5 rounded-lg">
        <h3 className="text-3xl font-medium font-serif">
          No registry configured
        </h3>
        <p className="text-base">
          This name must be migrated to ENSv2 before it can deploy and manage
          its own registry.
        </p>
      </div>
      <Button asChild className="w-full">
        <a href={MANAGER_MIGRATE_URL} target="_blank" rel="noopener noreferrer">
          <Plus className="size-4" />
          Migrate name to ENSv2
        </a>
      </Button>
    </div>
  )
}
