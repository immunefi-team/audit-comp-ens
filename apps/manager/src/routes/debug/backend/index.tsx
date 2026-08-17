import { qk } from '@ens-apps/utils/tanstack-query/queryKey'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import { queryOptions, useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { getAccount, signMessage } from '@wagmi/core'
import { useAtom } from '@xstate/store-react'
import { useMemo, useState } from 'react'
import { createSiweMessage } from 'viem/siwe'
import { useAccount } from 'wagmi'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { wagmiConfig } from '@/lib/wagmi'
import {
  backendAuthStore,
  backendClient,
  getSiweDomain,
  getSiweUri,
  isBackendAuthed,
} from '@/utils/backend-client'

export const Route = createFileRoute('/debug/backend/')({
  component: RouteComponent,
})

const getNonce = async () => {
  const response = await backendClient.auth.nonce.$post()
  if (!response.ok) {
    const { error } = await response.json()
    throw new Error(`Failed to get nonce: ${response.statusText} ${error}`)
  }

  return response.json().then((data) => data.nonce)
}

const MutationTester = <TData, TError, TVariables, TContext>({
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

const QueryTester = <TData, TError>({
  label,
  query,
}: {
  label: string
  query: UseQueryResult<TData, TError>
}) => {
  const status = useMemo(() => {
    if (query.isPending)
      return { text: 'Pending', variant: 'lightOrange' as const }
    if (query.isError) return { text: 'Error', variant: 'destructive' as const }
    if (query.isSuccess)
      return { text: 'Success', variant: 'secondary' as const }
    return { text: 'Idle', variant: 'gray' as const }
  }, [query.isPending, query.isError, query.isSuccess])

  return (
    <Card className="w-full">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">{label}</CardTitle>
        <Badge variant={status.variant}>{status.text}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Button
            disabled={query.isFetching}
            onClick={() => query.refetch()}
            type="button"
            variant="outline"
          >
            {query.isFetching ? 'Refetching...' : 'Refetch'}
          </Button>
        </div>
        {query.isPending && (
          <div className="text-muted-foreground text-sm">Loading...</div>
        )}
        {query.isError && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              <pre className="max-h-64 overflow-auto rounded bg-muted/30 p-2 font-mono text-xs">
                {JSON.stringify(query.error, null, 2)}
              </pre>
            </AlertDescription>
          </Alert>
        )}
        {query.isSuccess && (
          <div>
            <div className="mb-1 font-medium text-sm">Data</div>
            <pre className="max-h-64 overflow-auto rounded border bg-muted/30 p-2 font-mono text-xs">
              {JSON.stringify(query.data, null, 2)}
            </pre>
          </div>
        )}
        <div className="flex flex-wrap gap-2 text-muted-foreground text-xs">
          <div>
            <span className="font-semibold">isFetching:</span>{' '}
            {String(query.isFetching)}
          </div>
          <div>
            <span className="font-semibold">isStale:</span>{' '}
            {String(query.isStale)}
          </div>
          <div>
            <span className="font-semibold">isRefetching:</span>{' '}
            {String(query.isRefetching)}
          </div>
          <div>
            <span className="font-semibold">isSuccess:</span>{' '}
            {String(query.isSuccess)}
          </div>
          <div>
            <span className="font-semibold">isError:</span>{' '}
            {String(query.isError)}
          </div>
          <div>
            <span className="font-semibold">isPending:</span>{' '}
            {String(query.isPending)}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const loginMutation = async () => {
  const account = getAccount(wagmiConfig)

  if (!account?.address) {
    throw new Error('No account found')
  }

  const nonce = await getNonce()

  const domain = getSiweDomain()
  const uri = getSiweUri()

  const siweMessage = createSiweMessage({
    address: account.address,
    domain,
    nonce,
    chainId: wagmiConfig.chains[0].id,
    uri,
    version: '1',
  })

  const signedMessage = await signMessage(wagmiConfig, {
    message: siweMessage,
  })

  const response = await backendClient.auth.login.$post({
    json: {
      address: account.address,
      message: siweMessage,
      signature: signedMessage,
      nonce,
    },
  })

  if (!response.ok) {
    const data = await response.json()
    throw new Error(
      `Failed to login: ${response.statusText} ${JSON.stringify(data, null, 2)}`,
    )
  }

  const token = await response.json().then((data) => data.token)

  backendAuthStore.trigger.signIn({ authKey: token, address: account.address })
}

function RouteComponent() {
  const isAuthed = useAtom(isBackendAuthed)

  const login = useMutation({
    mutationFn: loginMutation,
  })

  const account = useAccount()

  if (!account.isConnected) {
    return (
      <div className="mx-auto max-w-4xl p-4">
        <Card>
          <CardHeader>
            <CardTitle>Backend Debug</CardTitle>
            <CardDescription>Connect your wallet to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertTitle>Wallet not connected</AlertTitle>
              <AlertDescription>
                Please connect a wallet to access backend debug tools.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isAuthed) {
    return (
      <div className="mx-auto max-w-4xl p-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Backend Debug</CardTitle>
              <CardDescription>
                Sign in with Ethereum to continue.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <MutationTester label="Login" mutation={login} />
          </CardContent>
        </Card>
      </div>
    )
  }

  return <AuthedComponent />
}

const AuthedComponent = () => {
  const me = useQuery({
    queryFn: async () => {
      const response = await backendClient.auth.me.$get()
      return response.json()
    },
    queryKey: ['me'],
    meta: {
      dependsOn: ['backend'],
    },
  })

  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex flex-col">
          <div className="font-semibold text-xl">Backend Debug</div>
          <div className="text-muted-foreground text-sm">
            Inspect account and favorites via the API
          </div>
        </div>
        <Button
          onClick={() => backendAuthStore.trigger.signOut()}
          type="button"
          variant="outline"
        >
          Logout
        </Button>
      </div>

      <Tabs className="w-full gap-4" defaultValue="account">
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="favorites">Favorites</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>
        <TabsContent value="account">
          <QueryTester label="Me" query={me} />
        </TabsContent>
        <TabsContent value="favorites">
          <FavoritesComponent />
        </TabsContent>
        <TabsContent value="notifications">
          <NotificationsComponent />
        </TabsContent>
      </Tabs>
    </div>
  )
}

const favoritesQuery = queryOptions({
  queryFn: async () => {
    const response = await backendClient.favorites.$get()
    return response.json()
  },
  queryKey: qk('favorites', 'get'),
})

const FavoritesComponent = () => {
  const favorites = useQuery(favoritesQuery)

  const addFavorite = useMutation({
    mutationFn: async (name: string) => {
      const response = await backendClient.favorites[':name'].$put({
        param: {
          name,
        },
      })
      return response.json()
    },
    mutationKey: qk('favorites', 'add'),
    meta: {
      invalidates: [
        [
          {
            $scope: 'favorites',
          },
        ],
      ],
    },
  })

  const deleteFavorite = useMutation({
    mutationFn: async (name: string) => {
      const response = await backendClient.favorites[':name'].$delete({
        param: { name },
      })
      return response.json()
    },
    mutationKey: qk('favorites', 'delete'),
    meta: {
      invalidates: [
        [
          {
            $scope: 'favorites',
          },
        ],
      ],
    },
  })

  const [newFavorite, setNewFavorite] = useState('')

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Favorites</CardTitle>
            <CardDescription>
              View, add, and remove favorite names
            </CardDescription>
          </div>
          <Badge variant={favorites.isPending ? 'lightOrange' : 'secondary'}>
            {favorites.isPending ? 'Loading' : 'Ready'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Input
            onChange={(e) => setNewFavorite(e.target.value)}
            placeholder="Add favorite"
            value={newFavorite}
          />
          <Button
            disabled={addFavorite.isPending || newFavorite.length === 0}
            onClick={() => {
              if (!newFavorite) return
              addFavorite.mutate(newFavorite, {
                onSuccess: () => setNewFavorite(''),
              })
            }}
            type="button"
          >
            {addFavorite.isPending ? 'Adding…' : 'Add'}
          </Button>
        </div>

        <div className="divide-y rounded-md border">
          {favorites.data && favorites.data.length > 0 ? (
            favorites.data.map((favorite) => (
              <div
                className="flex items-center justify-between px-3 py-2"
                key={favorite.name}
              >
                <div className="font-mono text-sm">{favorite.name}</div>
                <Button
                  disabled={deleteFavorite.isPending}
                  onClick={() => deleteFavorite.mutate(favorite.name)}
                  type="button"
                  variant="outline"
                >
                  {deleteFavorite.isPending ? 'Removing…' : 'Remove'}
                </Button>
              </div>
            ))
          ) : (
            <div className="px-3 py-6 text-center text-muted-foreground text-sm">
              No favorites yet. Add one above.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

const notificationsQuery = queryOptions({
  queryFn: async () => {
    const response = await backendClient.notifications.$get({
      query: {
        cursor: undefined,
      },
    })
    return response.json()
  },
  queryKey: qk('notifications', 'get'),
})

const NotificationsComponent = () => {
  const notifications = useQuery(notificationsQuery)

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-base">Notifications</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <QueryTester label="Notifications" query={notifications} />

        {/* <div className="rounded-md border p-2">{notifications.data}</div> */}
      </CardContent>
    </Card>
  )
}
