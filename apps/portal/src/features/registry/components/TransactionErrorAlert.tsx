import { AlertCircle } from 'lucide-react'
import type { ReactElement } from 'react'
import type { Hash } from 'viem'
import { CopyableRecord } from '@/components/CopyableRecord'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useBlockExplorerTxUrl } from '@/utils/blockExplorer/useBlockExplorerUrl'

interface TransactionErrorAlertProps {
  readonly title: string
  readonly summary: string
  readonly details?: string
  readonly txHash?: Hash
  readonly txHashLabel?: string
  readonly showIcon?: boolean
  readonly chainId?: number
}

export const TransactionErrorAlert = ({
  title,
  summary,
  details,
  txHash,
  txHashLabel = 'Tx hash:',
  showIcon = true,
  chainId,
}: TransactionErrorAlertProps): ReactElement => {
  const txUrl = useBlockExplorerTxUrl(txHash, chainId)
  return (
    <Alert variant="destructive" className="max-w-full">
      {showIcon && <AlertCircle />}
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="break-all whitespace-normal max-w-full overflow-wrap-anywhere">
        <div className="flex flex-col gap-2">
          <span>{summary}</span>
          {details && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Show details</summary>
              <pre className="whitespace-pre-wrap wrap-break-word max-h-48 overflow-auto">
                {details}
              </pre>
            </details>
          )}
          {txHash && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">
                {txHashLabel}
              </span>
              <CopyableRecord
                value={txHash}
                href={txUrl}
                className="text-xs"
                truncate={false}
              />
            </div>
          )}
        </div>
      </AlertDescription>
    </Alert>
  )
}
