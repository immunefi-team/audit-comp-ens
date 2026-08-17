import type { registrationMachine } from '@ens-apps/transaction-manager'
import { useActorRef, useSelector } from '@xstate/react'
import { createContext, use, useEffect, useRef } from 'react'
import type { Address } from 'viem'
import { useChainId } from 'wagmi'
import type { Actor, ActorRefFrom, SnapshotFrom } from 'xstate'
import { sepoliaWithEns } from '@/lib/wagmi'
import { verifyProxyContract } from '@/utils/blockExplorer/verifyProxyContract'
import {
  getRegistrationV2ChildActor,
  registrationV2UiMachine,
} from './registrationUi.machine'

const RegistrationV2UiContext2 = createContext<{
  uiActor: Actor<typeof registrationV2UiMachine>
  registrationActor: ActorRefFrom<typeof registrationMachine> | undefined
  /**
   * Label is an ENS name without the .eth suffix and not a subname
   */
  label: string
} | null>(null)

export type RegistrationV2UiActor = ActorRefFrom<typeof registrationV2UiMachine>
export type RegistrationV2UiSnapshot = SnapshotFrom<
  typeof registrationV2UiMachine
>

export const RegistrationV2UiProvider = ({
  children,
  label,
}: {
  children: React.ReactNode
  label: string
}) => {
  const chainId = useChainId()
  const registrationV2UiActor = useActorRef(registrationV2UiMachine, {
    input: { chainId },
  })
  const registrationActor = useSelector(
    registrationV2UiActor,
    getRegistrationV2ChildActor,
  )
  const previousLabel = useRef<string | undefined>(label)

  // The registration flow deploys a dedicated resolver proxy. Once its address
  // is known, ask Etherscan to link it to the already source-verified
  // implementation (Read/Write-as-Proxy). Fire-and-forget, latched per address.
  const resolverAddress = useSelector(
    registrationActor,
    (snapshot) => snapshot?.context.resolverAddress,
  )
  const verifiedResolverRef = useRef<Address | null>(null)
  useEffect(() => {
    if (!resolverAddress || verifiedResolverRef.current === resolverAddress) {
      return
    }
    verifiedResolverRef.current = resolverAddress
    void verifyProxyContract(sepoliaWithEns, resolverAddress)
  }, [resolverAddress])

  useEffect(() => {
    const subscription = registrationV2UiActor.subscribe({
      error: (error) => {
        console.error('Registration V2 UI error:', error)
      },
    })

    return subscription.unsubscribe
  }, [registrationV2UiActor])

  // Inform the UI actor that the label has changed and to cancel any ongoing transactions
  useEffect(() => {
    if (previousLabel.current === label) {
      return
    }

    previousLabel.current = label
    registrationV2UiActor.send({ type: 'label.changed' })
  }, [label, registrationV2UiActor])

  return (
    <RegistrationV2UiContext2.Provider
      value={{
        uiActor: registrationV2UiActor,
        registrationActor: registrationActor,
        label,
      }}
    >
      {children}
    </RegistrationV2UiContext2.Provider>
  )
}

export const useRegistrationV2Context = () => {
  const context = use(RegistrationV2UiContext2)
  if (!context) {
    throw new Error('You used a hook outside of the RegistrationV2Context')
  }
  return context
}

export const createRegistrationV2UiSelector =
  <T,>(
    selector: (snapshot: RegistrationV2UiSnapshot) => T,
    compare?: (a: T, b: T) => boolean,
  ) =>
  (uiActor: Actor<typeof registrationV2UiMachine>) =>
    useSelector(uiActor, selector, compare)

export const createRegistrationV2TransactionSelector =
  <T,>(
    selector: (
      snapshot?: SnapshotFrom<NonNullable<typeof registrationMachine>>,
    ) => T,
    compare?: (a: T, b: T) => boolean,
  ) =>
  (registrationActor?: ActorRefFrom<typeof registrationMachine>) =>
    useSelector(registrationActor, selector, compare)

export const useRegistrationV2Selector = <T,>(
  selector: (snapshot: RegistrationV2UiSnapshot) => T,
  compare?: (a: T, b: T) => boolean,
) => {
  const { uiActor } = useRegistrationV2Context()
  return useSelector(uiActor, selector, compare)
}

export const useRegistrationV2TransactionSelector = <T,>(
  selector: (
    snapshot?: SnapshotFrom<NonNullable<typeof registrationMachine>>,
  ) => T,
  compare?: (a: T, b: T) => boolean,
) => {
  const { registrationActor } = useRegistrationV2Context()

  return useSelector(registrationActor, selector, compare)
}

export const RegisterV2Context = {
  use: useRegistrationV2Context,
  createSelector: createRegistrationV2UiSelector,
  useSelector: useRegistrationV2Selector,
  createTxSelector: createRegistrationV2TransactionSelector,
  useTxSelector: useRegistrationV2TransactionSelector,
}
