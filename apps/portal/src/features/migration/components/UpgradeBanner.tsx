import { ArrowUpCircle, CircleAlert } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  LANDING_PAGE_BASE_URL,
  MANAGER_APP_BASE_URL,
} from '@/lib/constants/domain'

const MANAGER_MIGRATE_URL = `${MANAGER_APP_BASE_URL}/migration`
const LEARN_MORE_URL = `${LANDING_PAGE_BASE_URL}/ensv2`

/**
 * Prompts the connected owner of a migratable v1 name to upgrade it to ENSv2 in
 * the Manager app. Rendered only when the name is migratable and the owner
 * wallet is connected (gated by the caller).
 */
export const UpgradeBanner = ({ name }: { name: string }) => (
  <Alert
    variant="default"
    className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 p-5"
  >
    <div className="flex items-start gap-4 flex-col sm:flex-row sm:items-center">
      <CircleAlert className="size-6 shrink-0" />
      <p className="text-3xl font-normal leading-none tracking-[-0.02em] font-serif">
        Upgrade to ENSv2
      </p>
    </div>
    <div className="flex items-start lg:items-center gap-4 flex-col lg:flex-row">
      <p className="text-p">
        This name is reserved on ENS v2 until it is migrated from ENS v1{' '}
      </p>
      <div className="flex items-center gap-4">
        <Button
          className="rounded-xs"
          asChild
          variant="entity-outline"
          size="xs"
        >
          {/** biome-ignore lint/a11y/noAmbiguousAnchorText: aria-label is used */}
          <a
            href={LEARN_MORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Learn more about migrating ${name} to ENS v2`}
          >
            Learn more
          </a>
        </Button>
        <Button className="rounded-xs" asChild variant="entity" size="xs">
          <a
            href={MANAGER_MIGRATE_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ArrowUpCircle className="size-4 shrink-0" />
            Upgrade to v2
          </a>
        </Button>
      </div>
    </div>
  </Alert>
)
