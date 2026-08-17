import { createFileRoute } from '@tanstack/react-router'
import { TermsOfUsePage } from '@/features/legal/pages/TermsOfUsePage'

export const Route = createFileRoute('/legal/terms-of-use')({
  component: TermsOfUsePage,
})
