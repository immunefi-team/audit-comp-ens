import { createFileRoute } from '@tanstack/react-router'
import { useSelector } from '@xstate/store-react'
import { useEffect, useMemo, useState } from 'react'
import { match } from 'ts-pattern'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  backendAuthStore,
  DEFAULT_BACKEND_API_URL,
  getBackendApiBaseUrl,
} from '@/utils/backend-client'

export const Route = createFileRoute('/debug/backend/settings')({
  component: RouteComponent,
})

type BackendUrlMode = 'env' | 'proxy' | 'custom'

const getModeFromOverride = (override: string | undefined): BackendUrlMode => {
  if (!override) return 'env'
  if (override === '/api') return 'proxy'
  return 'custom'
}

const resolveBaseUrlForDisplay = (baseUrl: string) => {
  const resolved = baseUrl.startsWith('/')
    ? new URL(
        baseUrl,
        typeof window === 'undefined'
          ? 'http://localhost'
          : window.location.origin,
      )
    : new URL(baseUrl)

  return resolved.toString().replace(/\/$/, '')
}

const isValidCustomBaseUrl = (value: string) => {
  if (!value) return false
  if (value.startsWith('/')) return true

  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function RouteComponent() {
  const apiBaseUrlOverride = useSelector(
    backendAuthStore,
    (state) => state.context.apiBaseUrlOverride,
  )
  const [mode, setMode] = useState<BackendUrlMode>(() =>
    getModeFromOverride(apiBaseUrlOverride),
  )
  const [customInput, setCustomInput] = useState(() =>
    apiBaseUrlOverride && apiBaseUrlOverride !== '/api'
      ? apiBaseUrlOverride
      : '',
  )
  const [hasAttemptedApply, setHasAttemptedApply] = useState(false)

  useEffect(() => {
    const nextMode = getModeFromOverride(apiBaseUrlOverride)
    setMode(nextMode)
    if (nextMode === 'custom') {
      setCustomInput(apiBaseUrlOverride ?? '')
    }
  }, [apiBaseUrlOverride])

  // biome-ignore lint/correctness/useExhaustiveDependencies: we want to re-render when the base url changes
  const effectiveBaseUrl = useMemo(
    () => resolveBaseUrlForDisplay(getBackendApiBaseUrl()),
    [apiBaseUrlOverride],
  )

  const trimmedCustomInput = customInput.trim()
  const isCustomValid =
    mode !== 'custom' || isValidCustomBaseUrl(trimmedCustomInput)
  const customError = mode === 'custom' && hasAttemptedApply && !isCustomValid

  const handleApply = () => {
    setHasAttemptedApply(true)

    if (!isCustomValid) return

    const nextOverride = match(mode)
      .with('env', () => undefined)
      .with('proxy', () => '/api')
      .with('custom', () => trimmedCustomInput)
      .exhaustive()

    const currentEffective = resolveBaseUrlForDisplay(getBackendApiBaseUrl())
    const nextEffective = resolveBaseUrlForDisplay(
      nextOverride ?? DEFAULT_BACKEND_API_URL,
    )

    if (currentEffective !== nextEffective) {
      backendAuthStore.trigger.signOut()
    }

    if (nextOverride) {
      backendAuthStore.trigger.setApiBaseUrlOverride({ url: nextOverride })
    } else {
      backendAuthStore.trigger.clearApiBaseUrlOverride()
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold text-2xl">Backend Settings</h1>
        <p className="text-muted-foreground text-sm">
          Configure which backend API the manager uses for debug tools and
          notifications.
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>Backend API Base URL</CardTitle>
          <CardDescription>
            Choose where backend requests should be sent.
          </CardDescription>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary">Effective Base URL</Badge>
            <span className="rounded-md border bg-muted/40 px-2 py-1 font-mono text-xs">
              {effectiveBaseUrl}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Source</Label>
            <Tabs
              onValueChange={(value) => setMode(value as BackendUrlMode)}
              value={mode}
            >
              <TabsList>
                <TabsTrigger value="env">Environment</TabsTrigger>
                <TabsTrigger value="proxy">/api (Proxy)</TabsTrigger>
                <TabsTrigger value="custom">Custom</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="text-muted-foreground text-sm">
              Environment uses the build-time value from{' '}
              <span className="font-mono">VITE_API_URL</span> (fallback{' '}
              <span className="font-mono">/api</span>).
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom-backend-url">Custom base URL</Label>
            <Input
              disabled={mode !== 'custom'}
              id="custom-backend-url"
              onChange={(event) => setCustomInput(event.target.value)}
              placeholder="https://preview-api.example.com"
              value={customInput}
            />
            {customError && (
              <div className="text-destructive text-xs">
                Enter a URL starting with <span className="font-mono">/</span>{' '}
                or a full <span className="font-mono">http(s)</span> URL.
              </div>
            )}
          </div>

          <Alert>
            <AlertTitle>Heads up</AlertTitle>
            <AlertDescription>
              Applying changes signs you out of backend authentication.
            </AlertDescription>
          </Alert>

          <div className="flex justify-end">
            <Button onClick={handleApply} type="button">
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
