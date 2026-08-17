import type { UseMutationResult } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Alert } from '@/components'
import { AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export const MutationTester = <TData, TError, TVariables, TContext>({
  label,
  mutation,
  variables,
}: {
  label: string
  mutation: UseMutationResult<TData, TError, TVariables, TContext>
} & (TVariables extends void
  ? { variables?: TVariables }
  : { variables: () => TVariables })) => {
  const status = useMemo(() => {
    if (mutation.isPending)
      return { text: 'Pending', variant: 'lightOrange' as const }
    if (mutation.isError)
      return { text: 'Error', variant: 'destructive' as const }
    if (mutation.isSuccess)
      return { text: 'Success', variant: 'secondary' as const }
    return { text: 'Idle', variant: 'gray' as const }
  }, [mutation.isPending, mutation.isError, mutation.isSuccess])

  return (
    <Card className="w-full">
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base">{label}</CardTitle>
          <CardDescription className="text-xs">
            Trigger the action and view the result
          </CardDescription>
        </div>
        <Badge variant={status.variant}>{status.text}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {mutation.isError && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              <pre className="max-h-64 overflow-auto rounded bg-muted/30 p-2 font-mono text-xs">
                {JSON.stringify(mutation.error, null, 2)}
              </pre>
            </AlertDescription>
          </Alert>
        )}
        {mutation.isSuccess && (
          <div>
            <div className="mb-1 font-medium text-sm">Response</div>
            <pre className="max-h-64 overflow-auto rounded border bg-muted/30 p-2 font-mono text-xs">
              {JSON.stringify(mutation.data, null, 2)}
            </pre>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(variables?.() as TVariables)}
            type="button"
          >
            {mutation.isPending ? `${label}...` : label}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
