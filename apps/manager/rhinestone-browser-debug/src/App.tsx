import { customSepolia, SEPOLIA_RPC_URL } from '@ens-apps/indexer/chain'
import { ensL1Contracts, supportedL1Chains } from '@ensdomains/ensjs/chain'
import {
  type RhinestoneAccount,
  RhinestoneSDK,
  type Session,
  walletClientToAccount,
} from '@rhinestone/sdk'
import { experimental_enableSession } from '@rhinestone/sdk/actions/smart-sessions'
import { useEffect, useRef, useState } from 'react'
import {
  type Address,
  type Chain,
  createPublicClient,
  createWalletClient,
  custom,
  encodeFunctionData,
  formatUnits,
  type Hex,
  http,
  keccak256,
  parseUnits,
  toHex,
  zeroAddress,
  zeroHash,
} from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

// Payment tokens sourced from the ensjs Sepolia chain config so they can't
// drift from the tokens the app reads.
const ensjsSepolia = ensL1Contracts[supportedL1Chains.sepolia]
const SUPPORTED_TOKENS = {
  USDC: ensjsSepolia.usdc.address,
  DAI: ensjsSepolia.dai.address,
}

const ENS_SEPOLIA_CONTRACTS = {
  FastTestETHRegistrar: '0xe37a1366c827d18dc0ad57f3767de4b3025ceac2' as const,
  HCAFactory: '0x6a20c7f050f31f4b4cb1eaf060849629be10e6a1' as const,
  PublicResolver: '0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5' as const,
} as const

const FAST_TEST_REGISTRAR_ABI = [
  {
    inputs: [{ name: 'commitment', type: 'bytes32' }],
    name: 'commit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'commitment', type: 'bytes32' }],
    name: 'commitmentAt',
    outputs: [{ name: '', type: 'uint64' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'owner', type: 'address' },
      { name: 'secret', type: 'bytes32' },
      { name: 'subregistry', type: 'address' },
      { name: 'resolver', type: 'address' },
      { name: 'duration', type: 'uint64' },
      { name: 'paymentToken', type: 'address' },
      { name: 'referrer', type: 'bytes32' },
    ],
    name: 'register',
    outputs: [{ name: 'tokenId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'owner', type: 'address' },
      { name: 'secret', type: 'bytes32' },
      { name: 'subregistry', type: 'address' },
      { name: 'resolver', type: 'address' },
      { name: 'duration', type: 'uint64' },
      { name: 'referrer', type: 'bytes32' },
    ],
    name: 'makeCommitment',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [],
    name: 'MIN_COMMITMENT_AGE',
    outputs: [{ name: '', type: 'uint64' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'owner', type: 'address' },
      { name: 'duration', type: 'uint64' },
      { name: 'paymentToken', type: 'address' },
    ],
    name: 'rentPrice',
    outputs: [
      { name: 'base', type: 'uint256' },
      { name: 'premium', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'token', type: 'address' }],
    name: 'isPaymentToken',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'name', type: 'string' }],
    name: 'isAvailable',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

const ERC20_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
] as const

const HCA_FACTORY_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'hca', type: 'address' },
      { internalType: 'address', name: 'owner', type: 'address' },
    ],
    name: 'setAccountOwner',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'hca', type: 'address' }],
    name: 'getAccountOwner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

const publicClient = createPublicClient({
  chain: customSepolia,
  transport: http(SEPOLIA_RPC_URL),
})

type BrowserProvider = Parameters<typeof custom>[0]

type SessionBundle = {
  session: Session
  enableSignature: Hex
  hashesAndChainIds: { chainId: bigint; sessionDigest: Hex }[]
}

type LogType = 'info' | 'success' | 'warn' | 'error'

type LogEntry = {
  msg: string
  type: LogType
}

const CHECKPOINTS = [
  {
    id: 'connect',
    label: 'Connect MetaMask',
    hint: 'Confirms the external EOA signing path.',
  },
  {
    id: 'account',
    label: 'Create Smart Account',
    hint: 'Builds the Rhinestone account from the MetaMask owner.',
  },
  {
    id: 'deploy',
    label: 'Deploy With Warp',
    hint: 'Installs the account on-chain if it is still undeployed.',
  },
  {
    id: 'fund',
    label: 'Fund Smart Account',
    hint: 'Top up ETH and mock stablecoins for registration.',
  },
  {
    id: 'hca',
    label: 'Register HCA Owner',
    hint: 'Runs HCAFactory.setAccountOwner via a user-paid warp intent.',
  },
  {
    id: 'pricing',
    label: 'Validate Name And Price',
    hint: 'Checks name availability, token support, and required balance.',
  },
  {
    id: 'session',
    label: 'Enable Smart Session',
    hint: 'MetaMask signs the enable payload, then installs the session.',
  },
  {
    id: 'commit',
    label: 'Submit Commitment',
    hint: 'Creates and sends the ENS commitment intent.',
  },
  {
    id: 'cooldown',
    label: 'Wait Commitment Age',
    hint: 'Only waits when the registrar requires a delay.',
  },
  {
    id: 'bundle',
    label: 'Batch Approve + Register',
    hint: 'Sends the final session-signed registration bundle.',
  },
] as const

const VISIBLE_CHECKPOINTS = CHECKPOINTS.filter(
  (checkpoint) => checkpoint.id !== 'connect',
)

type CheckpointId = (typeof CHECKPOINTS)[number]['id']
type CheckpointStatus = 'pending' | 'active' | 'done' | 'error' | 'skipped'
type CheckpointMap = Record<
  CheckpointId,
  {
    status: CheckpointStatus
    detail?: string
  }
>

type RegistrationSummary = {
  name: string
  owner: Address
  price: bigint
  paymentToken: Address
  commitHash: string
  bundledRegisterHash: string
}

type BalanceSnapshot = {
  eth: string
  usdc: string
  dai: string
}

const Icons = {
  Terminal: () => (
    <svg
      aria-hidden="true"
      fill="none"
      height="20"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="20"
    >
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" x2="20" y1="19" y2="19" />
    </svg>
  ),
  Cpu: () => (
    <svg
      aria-hidden="true"
      fill="none"
      height="12"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="12"
    >
      <rect height="16" rx="2" width="16" x="4" y="4" />
      <rect height="6" width="6" x="9" y="9" />
      <line x1="9" x2="9" y1="1" y2="4" />
      <line x1="15" x2="15" y1="1" y2="4" />
      <line x1="9" x2="9" y1="20" y2="23" />
      <line x1="15" x2="15" y1="20" y2="23" />
      <line x1="20" x2="23" y1="9" y2="9" />
      <line x1="20" x2="23" y1="15" y2="15" />
      <line x1="1" x2="4" y1="9" y2="9" />
      <line x1="1" x2="4" y1="15" y2="15" />
    </svg>
  ),
  Activity: () => (
    <svg
      aria-hidden="true"
      fill="none"
      height="12"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="12"
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  Shield: () => (
    <svg
      aria-hidden="true"
      fill="none"
      height="12"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="12"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function formatError(error: unknown) {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`
  }

  return String(error)
}

function stringify(value: unknown) {
  return JSON.stringify(
    value,
    (_, entry) => (typeof entry === 'bigint' ? entry.toString() : entry),
    2,
  )
}

function sanitizeName(name: string) {
  return name.trim().replace(/\.eth$/i, '')
}

function createInitialLogs(): LogEntry[] {
  return [{ msg: '>>> TERMINAL_READY: Awaiting User Auth', type: 'info' }]
}

function inferLogType(message: string): LogType {
  const lowerMessage = message.toLowerCase()

  if (
    message.startsWith('✗') ||
    lowerMessage.includes('error') ||
    lowerMessage.includes('failed') ||
    lowerMessage.includes('stopped') ||
    lowerMessage.includes('insufficient') ||
    lowerMessage.includes('missing') ||
    lowerMessage.includes('not available')
  ) {
    return 'error'
  }

  if (
    message.startsWith('•') ||
    lowerMessage.includes('skipped') ||
    lowerMessage.includes('cooldown') ||
    lowerMessage.includes('waited ')
  ) {
    return 'warn'
  }

  if (
    message.startsWith('✓') ||
    lowerMessage.includes('connected owner') ||
    lowerMessage.includes('funding ready') ||
    lowerMessage.includes('session tx receipt') ||
    lowerMessage.includes('receipt:') ||
    lowerMessage.includes('registered')
  ) {
    return 'success'
  }

  return 'info'
}

function createCheckpointMap(): CheckpointMap {
  return Object.fromEntries(
    CHECKPOINTS.map((checkpoint) => [
      checkpoint.id,
      { status: 'pending' as const, detail: undefined },
    ]),
  ) as CheckpointMap
}

function getEthereumProvider() {
  if (!window.ethereum) {
    throw new Error('MetaMask provider not found on window.ethereum')
  }

  return window.ethereum
}

declare global {
  interface Window {
    ethereum?: BrowserProvider
  }
}

async function checkEthBalance(address: Address) {
  const balance = await publicClient.getBalance({ address })
  return {
    balance,
    formatted: `${formatUnits(balance, 18)} ETH`,
  }
}

async function checkTokenBalance(address: Address, token: Address) {
  const [balance, decimals, symbol] = await Promise.all([
    publicClient.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address],
    }),
    publicClient.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: 'decimals',
    }),
    publicClient.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: 'symbol',
    }),
  ])

  return {
    balance,
    decimals,
    symbol,
    formatted: `${formatUnits(balance, decimals)} ${symbol}`,
  }
}

function formatStatus(status: CheckpointStatus) {
  return status.toUpperCase()
}

function truncateMiddle(value: string, leading = 8, trailing = 6) {
  if (value.length <= leading + trailing + 3) {
    return value
  }

  return `${value.slice(0, leading)}...${value.slice(-trailing)}`
}

function formatPaymentToken(token: Address) {
  if (token.toLowerCase() === SUPPORTED_TOKENS.USDC.toLowerCase()) {
    return 'USDC'
  }

  if (token.toLowerCase() === SUPPORTED_TOKENS.DAI.toLowerCase()) {
    return 'DAI'
  }

  return token
}

function formatSummaryPrice(summary: RegistrationSummary) {
  if (
    summary.paymentToken.toLowerCase() === SUPPORTED_TOKENS.USDC.toLowerCase()
  ) {
    return `${formatUnits(summary.price, 6)} USDC`
  }

  if (
    summary.paymentToken.toLowerCase() === SUPPORTED_TOKENS.DAI.toLowerCase()
  ) {
    return `${formatUnits(summary.price, 18)} DAI`
  }

  return summary.price.toString()
}

function formatDuration(durationMs: number | null) {
  if (durationMs === null) {
    return '--:--'
  }

  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`
  }

  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`
}

export function App() {
  const apiKey = import.meta.env.VITE_RHINESTONE_API_KEY as string | undefined

  const logEndRef = useRef<HTMLDivElement | null>(null)
  const walletClientRef = useRef<ReturnType<typeof createWalletClient> | null>(
    null,
  )
  const rhinestoneAccountRef = useRef<RhinestoneAccount | null>(null)
  const sessionBundleRef = useRef<SessionBundle | null>(null)

  const [desiredName, setDesiredName] = useState('warpdebug')
  const [ownerAddress, setOwnerAddress] = useState<Address | null>(null)
  const [ownerIdentityLabel, setOwnerIdentityLabel] = useState<string | null>(
    null,
  )
  const [smartAccountAddress, setSmartAccountAddress] =
    useState<Address | null>(null)
  const [currentHcaOwner, setCurrentHcaOwner] = useState<Address | null>(null)
  const [smartAccountBalances, setSmartAccountBalances] =
    useState<BalanceSnapshot | null>(null)
  const [sequenceStartedAt, setSequenceStartedAt] = useState<number | null>(
    null,
  )
  const [sequenceElapsedMs, setSequenceElapsedMs] = useState<number>(0)
  const [lastSequenceDurationMs, setLastSequenceDurationMs] = useState<
    number | null
  >(null)
  const [busyLabel, setBusyLabel] = useState<string | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>(createInitialLogs)
  const [summary, setSummary] = useState<RegistrationSummary | null>(null)
  const [checkpointMap, setCheckpointMap] = useState<CheckpointMap>(
    createCheckpointMap(),
  )

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [])

  useEffect(() => {
    if (sequenceStartedAt === null) {
      return
    }

    const updateElapsed = () => {
      setSequenceElapsedMs(Date.now() - sequenceStartedAt)
    }

    updateElapsed()
    const intervalId = window.setInterval(updateElapsed, 1000)

    return () => window.clearInterval(intervalId)
  }, [sequenceStartedAt])

  const pushLog = (message: string, type?: LogType) => {
    setLogs((current) =>
      [...current, { msg: message, type: type ?? inferLogType(message) }].slice(
        -160,
      ),
    )
  }

  const requireApiKey = () => {
    if (!apiKey) {
      throw new Error(
        'VITE_RHINESTONE_API_KEY is missing from apps/manager/.env',
      )
    }

    return apiKey
  }

  const requireWalletClient = () => {
    const walletClient = walletClientRef.current
    if (!walletClient) {
      throw new Error('Connect MetaMask first')
    }
    return walletClient
  }

  const requireWalletAccountAddress = () => {
    const address = requireWalletClient().account?.address
    if (!address) {
      throw new Error('Connected wallet account address is missing')
    }
    return address
  }

  const loadBalanceSnapshot = async (
    address: Address,
  ): Promise<BalanceSnapshot> => {
    const [eth, usdc, dai] = await Promise.all([
      checkEthBalance(address),
      checkTokenBalance(address, SUPPORTED_TOKENS.USDC),
      checkTokenBalance(address, SUPPORTED_TOKENS.DAI),
    ])

    return {
      eth: eth.formatted,
      usdc: usdc.formatted,
      dai: dai.formatted,
    }
  }

  const refreshBalances = async (smartAccount?: Address | null) => {
    const nextSmartAccount = smartAccount ?? smartAccountAddress

    if (nextSmartAccount) {
      setSmartAccountBalances(await loadBalanceSnapshot(nextSmartAccount))
    } else {
      setSmartAccountBalances(null)
    }
  }

  const resolveOwnerIdentityLabel = async (address: Address) => {
    try {
      const ensName = await publicClient.getEnsName({ address })
      if (ensName) {
        return ensName
      }
    } catch {
      // Reverse resolution is optional here, so we silently fall back.
    }

    return truncateMiddle(address, 8, 6)
  }

  const setCheckpoint = (
    id: CheckpointId,
    status: CheckpointStatus,
    detail?: string,
  ) => {
    setCheckpointMap((current) => ({
      ...current,
      [id]: { status, detail },
    }))
  }

  const runCheckpoint = async <T,>(
    id: CheckpointId,
    label: string,
    callback: () => Promise<{
      value: T
      status?: 'done' | 'skipped'
      detail?: string
    }>,
  ) => {
    setBusyLabel(label)
    setCheckpoint(id, 'active')
    pushLog(`→ ${label}`)

    try {
      const result = await callback()
      const finalStatus = result.status ?? 'done'
      setCheckpoint(id, finalStatus, result.detail)
      pushLog(`${finalStatus === 'skipped' ? '•' : '✓'} ${label}`)
      if (result.detail) {
        pushLog(result.detail)
      }
      return result.value
    } catch (error) {
      const message = formatError(error)
      setCheckpoint(id, 'error', message)
      pushLog(`✗ ${label}`)
      pushLog(message)
      throw error
    } finally {
      setBusyLabel(null)
    }
  }

  const connectMetaMask = async () => {
    const provider = getEthereumProvider()
    const tempClient = createWalletClient({
      chain: customSepolia,
      transport: custom(provider),
    })

    const [address] = await tempClient.requestAddresses()
    if (!address) {
      throw new Error('MetaMask returned no account address')
    }

    const walletClient = createWalletClient({
      account: address,
      chain: customSepolia,
      transport: custom(provider),
    })

    walletClientRef.current = walletClient
    setOwnerAddress(address)
    setOwnerIdentityLabel(await resolveOwnerIdentityLabel(address))
    pushLog(`Connected owner: ${address}`)

    return walletClient
  }

  const createOrLoadRhinestoneAccount = async () => {
    const existing = rhinestoneAccountRef.current
    if (existing && smartAccountAddress) {
      return {
        owner: ownerAddress as Address,
        smartAccount: smartAccountAddress,
        rhinestoneAccount: existing,
      }
    }

    const walletClient = walletClientRef.current ?? (await connectMetaMask())
    const sdk = new RhinestoneSDK({ apiKey: requireApiKey() })
    const ownerAccount = walletClientToAccount(walletClient)
    const rhinestoneAccount = await sdk.createAccount({
      owners: {
        type: 'ecdsa',
        accounts: [ownerAccount],
      },
      experimental_sessions: { enabled: true },
    })

    const nextSmartAccountAddress = rhinestoneAccount.getAddress()
    rhinestoneAccountRef.current = rhinestoneAccount
    setSmartAccountAddress(nextSmartAccountAddress)
    pushLog(`Smart account: ${nextSmartAccountAddress}`)

    return {
      owner: requireWalletAccountAddress(),
      smartAccount: nextSmartAccountAddress,
      rhinestoneAccount,
    }
  }

  const autofundSmartAccount = async (params: {
    owner: Address
    smartAccount: Address
  }) => {
    const { owner, smartAccount } = params
    const walletClient = requireWalletClient()

    const ownerEth = await checkEthBalance(owner)
    pushLog(`Owner ETH: ${ownerEth.formatted}`)

    const smartEth = await checkEthBalance(smartAccount)
    const smartUsdc = await checkTokenBalance(
      smartAccount,
      SUPPORTED_TOKENS.USDC,
    )
    const smartDai = await checkTokenBalance(smartAccount, SUPPORTED_TOKENS.DAI)

    pushLog(`Smart account ETH: ${smartEth.formatted}`)
    pushLog(`Smart account USDC: ${smartUsdc.formatted}`)
    pushLog(`Smart account DAI: ${smartDai.formatted}`)

    if (smartEth.balance < parseUnits('0.01', 18)) {
      pushLog('Auto-funding smart account with 0.01 ETH...')
      const hash = await walletClient.sendTransaction({
        account: requireWalletAccountAddress(),
        chain: customSepolia,
        to: smartAccount,
        value: parseUnits('0.01', 18),
      })
      pushLog(`ETH funding tx: ${hash}`)
      await publicClient.waitForTransactionReceipt({ hash })
    }

    if (smartUsdc.balance < parseUnits('100', 6)) {
      pushLog('Auto-funding smart account with 1000 USDC...')
      const hash = await walletClient.writeContract({
        account: requireWalletAccountAddress(),
        address: SUPPORTED_TOKENS.USDC,
        abi: ERC20_ABI,
        chain: customSepolia,
        functionName: 'mint',
        args: [smartAccount, parseUnits('1000', 6)],
      })
      pushLog(`USDC mint tx: ${hash}`)
      await publicClient.waitForTransactionReceipt({ hash })
    }

    if (smartDai.balance < parseUnits('100', 18)) {
      pushLog('Auto-funding smart account with 1000 DAI...')
      const hash = await walletClient.writeContract({
        account: requireWalletAccountAddress(),
        address: SUPPORTED_TOKENS.DAI,
        abi: ERC20_ABI,
        chain: customSepolia,
        functionName: 'mint',
        args: [smartAccount, parseUnits('1000', 18)],
      })
      pushLog(`DAI mint tx: ${hash}`)
      await publicClient.waitForTransactionReceipt({ hash })
    }
  }

  const registerHca = async (params: {
    owner: Address
    smartAccount: Address
    rhinestoneAccount: RhinestoneAccount
  }) => {
    const { owner, smartAccount, rhinestoneAccount } = params

    const currentOwner = await publicClient.readContract({
      address: ENS_SEPOLIA_CONTRACTS.HCAFactory,
      abi: HCA_FACTORY_ABI,
      functionName: 'getAccountOwner',
      args: [smartAccount],
    })

    setCurrentHcaOwner(currentOwner)
    pushLog(`Current HCA owner: ${currentOwner}`)

    if (currentOwner.toLowerCase() === owner.toLowerCase()) {
      pushLog('HCA already registered to this owner.')
      return
    }

    if (currentOwner !== zeroAddress) {
      throw new Error(
        `HCA already registered to a different owner: ${currentOwner}`,
      )
    }

    const data = encodeFunctionData({
      abi: HCA_FACTORY_ABI,
      functionName: 'setAccountOwner',
      args: [smartAccount, owner],
    })

    pushLog('Submitting HCA registration via user-paid warp intent...')
    const tx = await rhinestoneAccount.sendTransaction({
      sourceChains: [customSepolia],
      targetChain: customSepolia,
      // User-paid in USDC — this deployment has no gas sponsorship.
      sponsored: { gas: false, bridging: false, swaps: false },
      feeAsset: 'USDC',
      calls: [
        {
          to: ENS_SEPOLIA_CONTRACTS.HCAFactory,
          data,
          value: 0n,
        },
      ],
    })

    pushLog(`HCA tx: ${stringify(tx)}`)
    const receipt = await rhinestoneAccount.waitForExecution(tx, false)
    pushLog(`HCA receipt: ${stringify(receipt)}`)

    const nextOwner = await publicClient.readContract({
      address: ENS_SEPOLIA_CONTRACTS.HCAFactory,
      abi: HCA_FACTORY_ABI,
      functionName: 'getAccountOwner',
      args: [smartAccount],
    })

    setCurrentHcaOwner(nextOwner)
    pushLog(`HCA owner after registration: ${nextOwner}`)
  }

  const enableSmartSession = async (
    rhinestoneAccount: RhinestoneAccount,
  ): Promise<SessionBundle> => {
    const cached = sessionBundleRef.current
    if (cached) {
      pushLog('Reusing the session created in this browser tab.')
      return cached
    }

    const sessionOwnerKey = generatePrivateKey()
    const sessionOwnerAccount = privateKeyToAccount(sessionOwnerKey)
    const session: Session = {
      chain: customSepolia,
      owners: {
        type: 'ecdsa',
        accounts: [sessionOwnerAccount],
      },
      actions: [{ policies: [{ type: 'sudo' }] }],
    }

    const sessionDetails =
      await rhinestoneAccount.experimental_getSessionDetails([session])
    pushLog(`Session details: ${stringify(sessionDetails)}`)

    const enableSignature =
      await rhinestoneAccount.experimental_signEnableSession(sessionDetails)
    pushLog(`Enable signature: ${enableSignature}`)

    const alreadyEnabled =
      typeof rhinestoneAccount.experimental_isSessionEnabled === 'function'
        ? await rhinestoneAccount.experimental_isSessionEnabled(session)
        : false

    if (!alreadyEnabled) {
      const enableCall = experimental_enableSession(
        session,
        enableSignature,
        sessionDetails.hashesAndChainIds,
        0,
      )
      try {
        pushLog('Trying enable-mode install (prepare -> sign -> submit)...')
        const perChainSigners = {
          type: 'experimental_session' as const,
          sessions: {
            [customSepolia.id]: {
              session,
              enableData: {
                userSignature: enableSignature,
                hashesAndChainIds: sessionDetails.hashesAndChainIds,
                sessionToEnableIndex: 0,
              },
            },
          },
        } as unknown as Parameters<
          RhinestoneAccount['prepareTransaction']
        >[0]['signers']
        const prepared = await rhinestoneAccount.prepareTransaction({
          chain: customSepolia,
          calls: [enableCall],
          sponsored: { gas: false, bridging: false, swaps: false },
          feeAsset: 'USDC',
          signers: perChainSigners,
        })
        const signed = await rhinestoneAccount.signTransaction(prepared)
        const enableTx = await rhinestoneAccount.submitTransaction(signed)
        pushLog(`Enable tx (enable-mode): ${stringify(enableTx)}`)
        const receipt = await rhinestoneAccount.waitForExecution(
          enableTx,
          false,
        )
        pushLog(`Enable-mode receipt: ${stringify(receipt)}`)
      } catch (error) {
        pushLog(
          `Enable-mode failed (${error instanceof Error ? error.message : String(error)}), falling back to sendTransaction`,
        )
        pushLog('Submitting session enable tx (legacy sendTransaction)...')
        const enableTx = await rhinestoneAccount.sendTransaction({
          sourceChains: [customSepolia],
          targetChain: customSepolia,
          calls: [enableCall],
          sponsored: { gas: false, bridging: false, swaps: false },
          feeAsset: 'USDC',
        })
        pushLog(`Enable tx (legacy): ${stringify(enableTx)}`)
        const receipt = await rhinestoneAccount.waitForExecution(
          enableTx,
          false,
        )
        pushLog(`Legacy enable receipt: ${stringify(receipt)}`)
      }
    }

    const bundle = {
      session,
      enableSignature,
      hashesAndChainIds: sessionDetails.hashesAndChainIds,
    }

    sessionBundleRef.current = bundle
    return bundle
  }

  const submitSponsoredSessionTransaction = async (
    rhinestoneAccount: RhinestoneAccount,
    chain: Chain,
    sessionBundle: SessionBundle,
    calls: Array<{ to: Address; data: Hex; value: bigint }>,
  ) => {
    const tx = await rhinestoneAccount.sendTransaction({
      sourceChains: [chain],
      targetChain: chain,
      calls,
      sponsored: { gas: false, bridging: false, swaps: false },
      feeAsset: 'USDC',
      signers: {
        type: 'experimental_session',
        session: sessionBundle.session,
        enableData: {
          userSignature: sessionBundle.enableSignature,
          hashesAndChainIds: sessionBundle.hashesAndChainIds,
          sessionToEnableIndex: 0,
        },
      },
    })

    pushLog(`Session tx submitted: ${stringify(tx)}`)
    const receipt = await rhinestoneAccount.waitForExecution(tx, false)
    pushLog(`Session tx receipt: ${stringify(receipt)}`)

    const txHash = receipt.fill.hash
    if (!txHash) {
      throw new Error('No tx hash returned from warp execution')
    }

    return txHash
  }

  const registerName = async () => {
    const startedAt = Date.now()

    setCheckpointMap(createCheckpointMap())
    setBusyLabel('Running full registration flow')
    setSequenceStartedAt(startedAt)
    setSequenceElapsedMs(0)
    setLastSequenceDurationMs(null)
    setSummary(null)
    pushLog('Starting one-button registration flow...')

    try {
      const cleanName = sanitizeName(desiredName)
      if (!cleanName) {
        throw new Error('Please enter a name label before registering')
      }

      await runCheckpoint('connect', 'Connect MetaMask', async () => {
        if (walletClientRef.current && ownerAddress) {
          return {
            value: walletClientRef.current,
            status: 'skipped' as const,
            detail: `Already connected as ${ownerAddress}`,
          }
        }

        const client = await connectMetaMask()
        return {
          value: client,
          detail: `Connected owner: ${requireWalletAccountAddress()}`,
        }
      })

      const { owner, smartAccount, rhinestoneAccount } = await runCheckpoint(
        'account',
        'Create Smart Account',
        async () => {
          if (
            rhinestoneAccountRef.current &&
            smartAccountAddress &&
            requireWalletAccountAddress()
          ) {
            return {
              value: {
                owner: requireWalletAccountAddress(),
                smartAccount: smartAccountAddress,
                rhinestoneAccount: rhinestoneAccountRef.current,
              },
              status: 'skipped' as const,
              detail: `Reusing smart account ${smartAccountAddress}`,
            }
          }

          const result = await createOrLoadRhinestoneAccount()
          return {
            value: result,
            detail: `Smart account: ${result.smartAccount}`,
          }
        },
      )
      const paymentToken = SUPPORTED_TOKENS.USDC
      const durationInSeconds = BigInt(365 * 24 * 60 * 60)

      await refreshBalances(smartAccount)

      pushLog(`Name: ${cleanName}.eth`)
      pushLog(`Payment token: ${paymentToken}`)

      await runCheckpoint('deploy', 'Deploy With Warp', async () => {
        const deployed = await rhinestoneAccount.isDeployed(customSepolia)
        if (deployed) {
          return {
            value: undefined,
            status: 'skipped' as const,
            detail: 'Smart account is already deployed',
          }
        }

        // `deploy` takes a plain boolean, not the per-flag object the
        // intent path uses. Either way: no sponsorship on this deployment.
        const deployTx = await rhinestoneAccount.deploy(customSepolia, {
          sponsored: false,
        })
        return {
          value: undefined,
          detail: `Deploy tx submitted: ${stringify(deployTx)}`,
        }
      })

      await runCheckpoint('fund', 'Fund Smart Account', async () => {
        await autofundSmartAccount({ owner, smartAccount })
        await refreshBalances(smartAccount)
        const fundedBalance = await checkTokenBalance(
          smartAccount,
          paymentToken,
        )
        return {
          value: undefined,
          detail: `Funding ready. Smart account now has ${fundedBalance.formatted}`,
        }
      })

      await runCheckpoint('hca', 'Register HCA Owner', async () => {
        const currentOwner = await publicClient.readContract({
          address: ENS_SEPOLIA_CONTRACTS.HCAFactory,
          abi: HCA_FACTORY_ABI,
          functionName: 'getAccountOwner',
          args: [smartAccount],
        })

        if (currentOwner.toLowerCase() === owner.toLowerCase()) {
          setCurrentHcaOwner(currentOwner)
          return {
            value: undefined,
            status: 'skipped' as const,
            detail: `HCA already points to ${currentOwner}`,
          }
        }

        await registerHca({ owner, smartAccount, rhinestoneAccount })
        return {
          value: undefined,
          detail: `HCA owner linked to ${owner}`,
        }
      })

      const { totalPrice } = await runCheckpoint(
        'pricing',
        'Validate Name And Price',
        async () => {
          const isAvailable = await publicClient.readContract({
            address: ENS_SEPOLIA_CONTRACTS.FastTestETHRegistrar,
            abi: FAST_TEST_REGISTRAR_ABI,
            functionName: 'isAvailable',
            args: [cleanName],
          })
          if (!isAvailable) {
            throw new Error(`Name ${cleanName}.eth is not available`)
          }

          const isTokenSupported = await publicClient.readContract({
            address: ENS_SEPOLIA_CONTRACTS.FastTestETHRegistrar,
            abi: FAST_TEST_REGISTRAR_ABI,
            functionName: 'isPaymentToken',
            args: [paymentToken],
          })
          if (!isTokenSupported) {
            throw new Error(
              `Token ${paymentToken} is not supported by registrar`,
            )
          }

          const [basePrice, premium] = (await publicClient.readContract({
            address: ENS_SEPOLIA_CONTRACTS.FastTestETHRegistrar,
            abi: FAST_TEST_REGISTRAR_ABI,
            functionName: 'rentPrice',
            args: [cleanName, owner, durationInSeconds, paymentToken],
          })) as [bigint, bigint]

          const nextTotalPrice = basePrice + premium
          const tokenBalance = await checkTokenBalance(
            smartAccount,
            paymentToken,
          )

          if (tokenBalance.balance < nextTotalPrice) {
            throw new Error(
              `Insufficient ${tokenBalance.symbol} balance on smart account ${smartAccount}`,
            )
          }

          return {
            value: {
              totalPrice: nextTotalPrice,
            },
            detail: `Available. Total price ${nextTotalPrice.toString()} with balance ${tokenBalance.formatted}`,
          }
        },
      )

      const sessionBundle = await runCheckpoint(
        'session',
        'Enable Smart Session',
        async () => {
          if (sessionBundleRef.current) {
            return {
              value: sessionBundleRef.current,
              status: 'skipped' as const,
              detail: 'Reusing the session created in this browser tab',
            }
          }

          const bundle = await enableSmartSession(rhinestoneAccount)
          return {
            value: bundle,
            detail: 'Smart session enabled and ready for session-signed txs',
          }
        },
      )

      const secret = keccak256(toHex(Math.random().toString()))
      const commitment = await publicClient.readContract({
        address: ENS_SEPOLIA_CONTRACTS.FastTestETHRegistrar,
        abi: FAST_TEST_REGISTRAR_ABI,
        functionName: 'makeCommitment',
        args: [
          cleanName,
          smartAccount,
          secret,
          zeroAddress,
          ENS_SEPOLIA_CONTRACTS.PublicResolver,
          durationInSeconds,
          zeroHash,
        ],
      })
      pushLog(`Commitment: ${commitment}`)

      const commitData = encodeFunctionData({
        abi: FAST_TEST_REGISTRAR_ABI,
        functionName: 'commit',
        args: [commitment],
      })

      const commitHash = await runCheckpoint(
        'commit',
        'Submit Commitment',
        async () => {
          const txHash = await submitSponsoredSessionTransaction(
            rhinestoneAccount,
            customSepolia,
            sessionBundle,
            [
              {
                to: ENS_SEPOLIA_CONTRACTS.FastTestETHRegistrar,
                data: commitData,
                value: 0n,
              },
            ],
          )

          return {
            value: txHash,
            detail: `Commit tx hash: ${txHash}`,
          }
        },
      )

      await sleep(3000)

      await runCheckpoint('cooldown', 'Wait Commitment Age', async () => {
        try {
          const minAge = (await publicClient.readContract({
            address: ENS_SEPOLIA_CONTRACTS.FastTestETHRegistrar,
            abi: FAST_TEST_REGISTRAR_ABI,
            functionName: 'MIN_COMMITMENT_AGE',
          })) as bigint
          const committedAt = (await publicClient.readContract({
            address: ENS_SEPOLIA_CONTRACTS.FastTestETHRegistrar,
            abi: FAST_TEST_REGISTRAR_ABI,
            functionName: 'commitmentAt',
            args: [commitment],
          })) as bigint

          if (committedAt === 0n) {
            await sleep(3000)
          }

          const latestBlock = await publicClient.getBlock()
          const nowTs = latestBlock.timestamp as bigint
          const elapsed = nowTs - committedAt

          if (minAge > 0n && elapsed < minAge) {
            const waitSeconds = Number(minAge - elapsed)
            await sleep(waitSeconds * 1000)
            return {
              value: undefined,
              detail: `Waited ${waitSeconds}s for commitment cooldown`,
            }
          }

          return {
            value: undefined,
            status: 'skipped' as const,
            detail: 'Registrar cooldown already satisfied',
          }
        } catch (error) {
          return {
            value: undefined,
            status: 'skipped' as const,
            detail: `Cooldown check skipped: ${formatError(error)}`,
          }
        }
      })

      const approveData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [ENS_SEPOLIA_CONTRACTS.FastTestETHRegistrar, totalPrice],
      })
      const registerData = encodeFunctionData({
        abi: FAST_TEST_REGISTRAR_ABI,
        functionName: 'register',
        args: [
          cleanName,
          smartAccount,
          secret,
          zeroAddress,
          ENS_SEPOLIA_CONTRACTS.PublicResolver,
          durationInSeconds,
          paymentToken,
          zeroHash,
        ],
      })

      const bundledRegisterHash = await runCheckpoint(
        'bundle',
        'Batch Approve + Register',
        async () => {
          const txHash = await submitSponsoredSessionTransaction(
            rhinestoneAccount,
            customSepolia,
            sessionBundle,
            [
              {
                to: paymentToken.toLowerCase() as Address,
                data: approveData,
                value: 0n,
              },
              {
                to: ENS_SEPOLIA_CONTRACTS.FastTestETHRegistrar,
                data: registerData,
                value: 0n,
              },
            ],
          )

          return {
            value: txHash,
            detail: `Approve + register bundle hash: ${txHash}`,
          }
        },
      )

      setSummary({
        name: `${cleanName}.eth`,
        owner: smartAccount,
        price: totalPrice,
        paymentToken,
        commitHash,
        bundledRegisterHash,
      })
    } catch (error) {
      pushLog(`Registration flow stopped: ${formatError(error)}`)
    } finally {
      const durationMs = Date.now() - startedAt
      setSequenceElapsedMs(durationMs)
      setLastSequenceDurationMs(durationMs)
      setSequenceStartedAt(null)
      setBusyLabel(null)
    }
  }

  const connectDebuggerSession = async () => {
    if (busyLabel) {
      return
    }

    setBusyLabel('Connecting wallet')

    try {
      await connectMetaMask()

      if (!apiKey) {
        await refreshBalances(null)
        return
      }

      const { smartAccount } = await createOrLoadRhinestoneAccount()
      await refreshBalances(smartAccount)
      pushLog(`Debugger ready for ${smartAccount}`, 'success')
    } catch (error) {
      pushLog(`Connection failed: ${formatError(error)}`, 'error')
    } finally {
      setBusyLabel(null)
    }
  }

  const disconnectDebuggerSession = () => {
    if (busyLabel) {
      return
    }

    walletClientRef.current = null
    rhinestoneAccountRef.current = null
    sessionBundleRef.current = null
    setOwnerAddress(null)
    setOwnerIdentityLabel(null)
    setSmartAccountAddress(null)
    setCurrentHcaOwner(null)
    setSmartAccountBalances(null)
    setSequenceStartedAt(null)
    setSequenceElapsedMs(0)
    setLastSequenceDurationMs(null)
    setSummary(null)
    setCheckpointMap(createCheckpointMap())
    pushLog('Local debugger session cleared', 'warn')
  }

  const completedCount = VISIBLE_CHECKPOINTS.filter(
    (checkpoint) =>
      checkpointMap[checkpoint.id].status === 'done' ||
      checkpointMap[checkpoint.id].status === 'skipped',
  ).length
  const activeCheckpoint = VISIBLE_CHECKPOINTS.find(
    (checkpoint) => checkpointMap[checkpoint.id].status === 'active',
  )
  const runButtonLabel = apiKey
    ? busyLabel
      ? 'EXECUTING...'
      : 'RUN_SEQUENCE'
    : 'API_KEY_REQUIRED'
  const walletButtonLabel = ownerIdentityLabel ?? 'CONNECT_WALLET'
  const sequenceTimeLabel = formatDuration(
    sequenceStartedAt === null ? lastSequenceDurationMs : sequenceElapsedMs,
  )
  const phaseLabel =
    activeCheckpoint?.label ??
    (checkpointMap.connect.status === 'active'
      ? 'Wallet Auth'
      : (busyLabel ?? 'Idle'))

  return (
    <main className="terminal-app">
      <div className="terminal-scanline" />

      <div className="terminal-shell">
        <header className="terminal-header">
          <div className="terminal-brand">
            <div className="terminal-brand-icon">
              <Icons.Terminal />
            </div>

            <div>
              <h1 className="terminal-title">
                ENS v2 <span>using Rhinestone Warp</span>
              </h1>
              <div className="terminal-meta">
                <span>
                  <Icons.Cpu />
                  SEPOLIA
                </span>
                <span className="terminal-meta-live">
                  <Icons.Activity />
                  {busyLabel ? 'EXECUTING' : 'ONLINE'}
                </span>
              </div>
            </div>
          </div>

          <div className="terminal-header-actions">
            <button
              className="terminal-secondary-button"
              disabled={busyLabel !== null}
              onClick={() =>
                ownerAddress
                  ? disconnectDebuggerSession()
                  : void connectDebuggerSession()
              }
              title={ownerAddress ?? undefined}
              type="button"
            >
              {walletButtonLabel}
            </button>
          </div>
        </header>

        <div className="terminal-grid">
          <div className="terminal-info-column">
            <section className="terminal-panel terminal-panel-soft">
              <label className="terminal-input-label" htmlFor="desired-name">
                Target_Domain
              </label>
              <div className="terminal-input-wrap">
                <input
                  id="desired-name"
                  onChange={(event) => setDesiredName(event.target.value)}
                  placeholder="warpdebug"
                  value={desiredName}
                />
                <span>.eth</span>
              </div>

              <div className="terminal-input-actions">
                <button
                  className="terminal-run-button"
                  disabled={busyLabel !== null || !apiKey}
                  onClick={() => void registerName()}
                  type="button"
                >
                  {runButtonLabel}
                </button>
              </div>

              <div className="terminal-stat-grid">
                <article className="terminal-stat-card">
                  <p>ACTIVE_STAGE</p>
                  <strong>{phaseLabel}</strong>
                </article>
                <article className="terminal-stat-card">
                  <p>CHECKPOINTS</p>
                  <strong>
                    {completedCount}/{VISIBLE_CHECKPOINTS.length}
                  </strong>
                </article>
                <article className="terminal-stat-card">
                  <p>PAYMENT_RAIL</p>
                  <strong>{formatPaymentToken(SUPPORTED_TOKENS.USDC)}</strong>
                </article>
                <article className="terminal-stat-card">
                  <p>SESSION_STATE</p>
                  <strong>
                    {sessionBundleRef.current ? 'ARMED' : 'UNSET'}
                  </strong>
                </article>
                <article className="terminal-stat-card">
                  <p>SEQUENCE_TIMER</p>
                  <strong>{sequenceTimeLabel}</strong>
                </article>
              </div>

              <div className="terminal-balance-section">
                <div className="terminal-section-heading terminal-section-heading-tight">
                  <h2>Balances</h2>
                  <p>
                    Owner and smart account balances update after connect and
                    funding.
                  </p>
                </div>

                <div className="terminal-balance-grid">
                  <article className="terminal-balance-card">
                    <p>ETH</p>
                    <strong>{smartAccountBalances?.eth ?? 'WAIT_INIT'}</strong>
                  </article>
                  <article className="terminal-balance-card">
                    <p>MOCK_USDC</p>
                    <strong>{smartAccountBalances?.usdc ?? 'WAIT_INIT'}</strong>
                  </article>
                  <article className="terminal-balance-card">
                    <p>MOCK_DAI</p>
                    <strong>{smartAccountBalances?.dai ?? 'WAIT_INIT'}</strong>
                  </article>
                </div>
              </div>

              <div className="terminal-info-block">
                <p>Chain ID: {customSepolia.id}</p>
                <p>HCA Factory: {ENS_SEPOLIA_CONTRACTS.HCAFactory}</p>
                <p>
                  Auto-funding stays enabled, so the flow tops up ETH and mock
                  stablecoins before registration when needed.
                </p>
                {apiKey ? null : (
                  <p className="terminal-warning">
                    `VITE_RHINESTONE_API_KEY` is missing from
                    `apps/manager/.env`.
                  </p>
                )}
              </div>
            </section>
          </div>

          <div className="terminal-status-column">
            <section className="terminal-panel terminal-panel-soft terminal-pipeline-panel">
              <div className="terminal-section-heading">
                <h2>Pipeline_Status</h2>
                <p>Watch the exact phase that owns the next wallet prompt.</p>
              </div>

              <div className="terminal-pipeline-list">
                {VISIBLE_CHECKPOINTS.map((checkpoint, index) => {
                  const state = checkpointMap[checkpoint.id]
                  return (
                    <article
                      className={`terminal-checkpoint terminal-checkpoint--${state.status}`}
                      key={checkpoint.id}
                    >
                      <div className="terminal-checkpoint-rail" />
                      <div className="terminal-checkpoint-copy">
                        <div className="terminal-checkpoint-row">
                          <p>
                            {index + 1}. {checkpoint.label}
                          </p>
                          <span
                            className={`terminal-badge terminal-badge--${state.status}`}
                          >
                            {formatStatus(state.status)}
                          </span>
                        </div>
                        <p className="terminal-checkpoint-hint">
                          {state.detail ?? checkpoint.hint}
                        </p>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          </div>

          <div className="terminal-main">
            <section className="terminal-console">
              <div className="terminal-console-header">
                <span className="terminal-console-title">
                  <span className="terminal-console-dot" />
                  ROOT@WARP:~ /SYSTEM.LOG
                </span>
                <div className="terminal-console-actions">
                  <span>{'UTF-8 // SECURE_TTY'}</span>
                  <button
                    className="terminal-clear-button"
                    onClick={() => setLogs(createInitialLogs())}
                    type="button"
                  >
                    CLEAR
                  </button>
                </div>
              </div>

              <div className="terminal-log-output">
                {logs.map((entry, index) => (
                  <div
                    className="terminal-log-line"
                    // biome-ignore lint/suspicious/noArrayIndexKey: append-only terminal log; the index is the stable position and is also rendered as the line number
                    key={`${entry.msg}-${index}`}
                  >
                    <span className="terminal-log-index">
                      [{index.toString().padStart(3, '0')}]
                    </span>
                    <span
                      className={`terminal-log-text terminal-log-text--${entry.type}`}
                    >
                      {entry.msg}
                    </span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </section>

            <section className="terminal-panel terminal-summary">
              <h2 className="terminal-summary-heading">
                <Icons.Shield />
                Output_Manifest
              </h2>

              {summary ? (
                <div className="terminal-summary-grid">
                  <article>
                    <p>Domain_Secured</p>
                    <strong className="terminal-summary-name">
                      {summary.name}
                    </strong>
                  </article>
                  <article>
                    <p>Settlement_Bundle</p>
                    <code title={summary.bundledRegisterHash}>
                      {truncateMiddle(summary.bundledRegisterHash, 12, 12)}
                    </code>
                  </article>
                  <article>
                    <p>Commit_Tx</p>
                    <code title={summary.commitHash}>
                      {truncateMiddle(summary.commitHash, 12, 12)}
                    </code>
                  </article>
                  <article>
                    <p>Owner</p>
                    <code title={summary.owner}>
                      {truncateMiddle(summary.owner, 12, 10)}
                    </code>
                  </article>
                  <article>
                    <p>Price</p>
                    <strong>{formatSummaryPrice(summary)}</strong>
                  </article>
                  <article>
                    <p>Payment_Token</p>
                    <strong>{formatPaymentToken(summary.paymentToken)}</strong>
                  </article>
                </div>
              ) : (
                <div className="terminal-summary-empty">
                  * AWAITING_FINAL_EXECUTION *
                </div>
              )}
            </section>
          </div>
        </div>

        <footer className="terminal-footer">
          <div className="terminal-footer-items">
            <span>
              EOA:
              <strong title={ownerAddress ?? undefined}>
                {ownerAddress
                  ? truncateMiddle(ownerAddress, 10, 8)
                  : 'WAIT_AUTH'}
              </strong>
            </span>
            <span>
              SA:
              <strong title={smartAccountAddress ?? undefined}>
                {smartAccountAddress
                  ? truncateMiddle(smartAccountAddress, 10, 8)
                  : 'WAIT_INIT'}
              </strong>
            </span>
            <span>
              HCA:
              <strong title={currentHcaOwner ?? undefined}>
                {currentHcaOwner
                  ? truncateMiddle(currentHcaOwner, 10, 8)
                  : 'UNMAPPED'}
              </strong>
            </span>
          </div>

          <div className="terminal-footer-status">
            <span>
              {apiKey ? 'RHINESTONE_SDK // WARP_ENGINE' : 'CONFIG_LOCKED'}
            </span>
            <div aria-hidden="true" className="terminal-footer-dots">
              <span />
              <span />
              <span />
            </div>
          </div>
        </footer>
      </div>
    </main>
  )
}
