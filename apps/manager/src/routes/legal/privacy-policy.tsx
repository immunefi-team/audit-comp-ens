import { createFileRoute } from '@tanstack/react-router'
import { PrivacyPolicyPage } from '@/features/legal/pages/PrivacyPolicyPage'

export const Route = createFileRoute('/legal/privacy-policy')({
  component: PrivacyPolicyPage,
})
