import type { LucideIcon } from 'lucide-react'
import {
  ArrowRightLeft,
  Circle,
  Clock,
  EyeOff,
  GitBranch,
  Lock,
  RefreshCw,
  Route,
  Sprout,
  UserRoundPlus,
} from 'lucide-react'
import type { ActionIcon } from '../summarize/summarize.types'

export const ACTION_ICONS: Record<ActionIcon, LucideIcon> = {
  address: Route,
  text: Route,
  records: Route,
  contenthash: Route,
  resolver: Route,
  primary: ArrowRightLeft,
  transfer: ArrowRightLeft,
  subname: GitBranch,
  registry: GitBranch,
  register: Sprout,
  renew: RefreshCw,
  grant: UserRoundPlus,
  revoke: EyeOff,
  migrate: ArrowRightLeft,
  fuses: Lock,
  expiry: Clock,
  default: Circle,
}
