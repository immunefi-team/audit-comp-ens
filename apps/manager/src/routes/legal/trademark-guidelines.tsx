import { createFileRoute } from '@tanstack/react-router'
import { TrademarkGuidelinesPage } from '@/features/legal/pages/TrademarkGuidelinesPage'

export const Route = createFileRoute('/legal/trademark-guidelines')({
  component: TrademarkGuidelinesPage,
})
