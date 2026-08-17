import { Trans } from '@lingui/react/macro'
import { CircleArrowDown, ExternalLink } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

const faqItems: { id: string; question: ReactNode; answer: ReactNode }[] = [
  {
    id: 'upgrade-names',
    question: (
      <Trans>Do I have to upgrade my names? What happens if I don't?</Trans>
    ),
    answer: (
      <Trans>
        Upgrading is optional. Your existing names keep working as they do
        today. Upgrading unlocks the latest features and lower fees, and you can
        do it whenever you're ready.
      </Trans>
    ),
  },
  {
    id: 'send-crypto',
    question: (
      <Trans>Can I send crypto to a .eth name (instead of an address)?</Trans>
    ),
    answer: (
      <Trans>
        Yes. Type alice.eth in the 'send to' field instead of 0x74...2d35 - the
        app looks up the address automatically.
      </Trans>
    ),
  },
  {
    id: 'what-is-primary-name',
    question: <Trans>What is a primary name?</Trans>,
    answer: (
      <Trans>
        Your primary name is the .eth name that apps show in place of your
        wallet address, so people see alice.eth instead of 0x74...2d35.
      </Trans>
    ),
  },
  {
    id: 'show-name',
    question: <Trans>How do I show my .eth name instead of my address?</Trans>,
    answer: (
      <Trans>
        Set it as your primary name from the primary name card on your
        Dashboard.
      </Trans>
    ),
  },
  {
    id: 'change-primary-name',
    question: <Trans>Can I change my primary name later?</Trans>,
    answer: (
      <Trans>
        Yes. You can update it anytime. You can even use different primary names
        on different networks (L2s).
      </Trans>
    ),
  },
  {
    id: 'secure-name',
    question: <Trans>How can I secure my ENS name?</Trans>,
    answer: (
      <Trans>
        Keep ownership in a cold wallet (a wallet you do not use every day).
        Then use a hot wallet (your daily wallet) to manage records and use the
        name.
      </Trans>
    ),
  },
]

export const FaqSection = () => (
  <div className="border-[0.25px] border-border bg-white px-4 py-6 md:rounded-xl md:px-6 md:py-8">
    <h2 className="mb-3 text-[24px] text-foreground leading-[0.96] tracking-[0.24px] md:text-[28px] md:tracking-[0.28px]">
      <Trans>Frequently Asked Questions</Trans>
    </h2>
    <div className="flex flex-col">
      {faqItems.map(({ id, question, answer }) => (
        <Collapsible key={id}>
          <div className="border-ens-gray-two border-b-[0.4px] last:border-b-0">
            <CollapsibleTrigger className="group flex h-14 w-full items-center justify-between text-left font-sans text-[16px] text-foreground leading-[20px] md:text-[20px] md:leading-[22px]">
              <span>{question}</span>
              <CircleArrowDown
                className="size-6 text-foreground transition-transform duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] group-data-[state=open]:rotate-180 motion-reduce:transition-none"
                strokeWidth={1}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden text-muted-foreground text-sm data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down motion-reduce:animate-none">
              <div className="pb-4">{answer}</div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      ))}
    </div>
    {/* has-[>svg]:px-0 neutralises the default button size's has-[>svg]:px-3,
        which p-0 can't override, so the link sits flush-left with the FAQ text. */}
    <Button
      asChild
      className="mt-4 h-auto w-auto gap-[4.92px] bg-transparent p-0 font-sans text-[13px] text-ens-blue leading-[1.6] tracking-normal hover:bg-transparent hover:text-ens-blue-hover has-[>svg]:px-0 md:text-sm md:leading-[1.8]"
      variant="link"
    >
      <a
        href="https://support.ens.domains"
        rel="noopener noreferrer"
        target="_blank"
      >
        <Trans>Need more help? Visit ENS Support Docs</Trans>
        <ExternalLink className="size-3 md:size-4" strokeWidth={2} />
      </a>
    </Button>
  </div>
)
