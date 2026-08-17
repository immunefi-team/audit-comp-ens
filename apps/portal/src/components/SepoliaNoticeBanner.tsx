import { useEffect, useState } from 'react'
import { Alert, AlertClose, AlertDescription } from '@/components/ui/alert'

const LAST_SEPOLIA_DEPLOYMENT_DATE = 'July 30, 2026'
const SEPOLIA_NOTICE_DISMISSED_KEY = `sepolia-notice-dismissed-${LAST_SEPOLIA_DEPLOYMENT_DATE}`

export const SepoliaNoticeBanner = () => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const isDismissed =
      window.localStorage.getItem(SEPOLIA_NOTICE_DISMISSED_KEY) === 'true'
    setIsVisible(!isDismissed)
  }, [])

  const dismissBanner = () => {
    window.localStorage.setItem(SEPOLIA_NOTICE_DISMISSED_KEY, 'true')
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <div className="w-full px-4 py-3 sm:px-6">
      <Alert variant="warning" className="mx-auto max-w-7xl">
        <AlertDescription className="pr-10">
          Notice: ENS v2 is in active development. Registered names on Sepolia
          and state data may be reset periodically due to routine contract
          deployments. The most recent deployment was on{' '}
          {LAST_SEPOLIA_DEPLOYMENT_DATE}.
        </AlertDescription>
        <AlertClose onClick={dismissBanner} />
      </Alert>
    </div>
  )
}
