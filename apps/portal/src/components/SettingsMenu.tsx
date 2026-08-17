import { usePostHog } from '@posthog/react'
import { MessageSquareTextIcon } from 'lucide-react'
import { ProfileSettingsIcon } from '@/assets/icons'
import { ThemeToggle } from './ThemeToggle'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

// PostHog feedback survey opened from the menu instead of the floating tab,
// which competed with primary CTAs and covered the search input on mobile.
const FEEDBACK_SURVEY_ID = import.meta.env
  .VITE_PUBLIC_POSTHOG_FEEDBACK_SURVEY_ID

const FeedbackMenuItem = () => {
  const posthog = usePostHog()

  if (!FEEDBACK_SURVEY_ID) return null

  return (
    <DropdownMenuItem
      onSelect={() =>
        posthog.displaySurvey(FEEDBACK_SURVEY_ID, {
          displayType: 'popover',
          ignoreConditions: true,
          ignoreDelay: true,
        })
      }
    >
      <MessageSquareTextIcon className="size-4" />
      Feedback
    </DropdownMenuItem>
  )
}

export const SettingsMenu = () => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Settings"
        >
          <ProfileSettingsIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" className="min-w-52">
        <ThemeToggle />
        <FeedbackMenuItem />
        {/* <DropdownMenuItem asChild>
          <ExternalLink href="https://sepolia.etherscan.io">
            <ChipLinkIcon className="size-3" />
            Sepolia explorer
          </ExternalLink>
        </DropdownMenuItem> */}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
