import {
  type CoinName,
  coinNameToTypeMap,
  coinTypeToNameMap,
} from '@ensdomains/address-encoder'

export type CoinConfig = {
  /** Short name (e.g., "eth", "btc") */
  name: string
  /** Long name (e.g., "Ethereum", "Bitcoin") */
  longName: string
  /** SLIP-44 coin type */
  coinType: number
  /** Icon path, or null if no icon exists */
  icon: string | null
}

/** Coins that have icons in /address/{Name}Icon.svg */
const COINS_WITH_ICONS = [
  'eth',
  'btc',
  'ltc',
  'doge',
  'sol',
  'matic',
  'op',
  'arb1',
  'base',
  'bnb',
  'atom',
  'xrp',
  'ada',
  'dot',
  'avax',
  'linea',
  'strk',
  'zora',
  'zksync',
  'metis',
  'celo',
  'abbc',
  'ae',
  'aion',
  'algo',
  'ar',
  'ardr',
  'ark',
  'bcd',
  'bch',
  'bcn',
  'btg',
  'bts',
  'ckb',
  'clo',
  'cro',
  'dash',
  'dcr',
  'dgb',
  'divi',
  'egld',
  'ela',
  'eos',
  'etc',
  'etn',
  'ewt',
  'fil',
  'flow',
  'ftm',
  'gno',
  'go',
  'grin',
  'hbar',
  'hive',
  'hnt',
  'icx',
  'iost',
  'iota',
  'iotx',
  'iris',
  'kava',
  'kmd',
  'ksm',
  'lsk',
  'luna',
  'nano',
  'nas',
  'near',
  'neo',
  'nrg',
  'nuls',
  'one',
  'ont',
  'poa',
  'ppc',
  'qtum',
  'rdd',
  'rune',
  'rvn',
  'srm',
  'steem',
  'strat',
  'stx',
  'sys',
  'tfuel',
  'theta',
  'tomo',
  'trx',
  'vet',
  'via',
  'vlx',
  'vsys',
  'wan',
  'waves',
  'xem',
  'xhv',
  'xlm',
  'xmr',
  'xtz',
  'xvg',
  'zec',
  'zen',
  'zil',
] as const

/** Priority coins shown at the top of the list */
const PRIORITY_COINS = [
  'eth',
  'btc',
  'sol',
  'matic',
  'op',
  'arb1',
  'base',
  'bnb',
  'ltc',
  'doge',
  'xrp',
  'ada',
  'dot',
  'avax',
  'atom',
]

/**
 * Get the icon path for a coin name
 * Icons follow the pattern: /address/{PascalCaseName}Icon.svg
 */
function getIconPath(coinName: string): string | null {
  if (
    !COINS_WITH_ICONS.includes(coinName as (typeof COINS_WITH_ICONS)[number])
  ) {
    return null
  }

  // Handle special cases for icon naming
  const iconNameMap: Record<string, string> = {
    arb1: 'Arb',
    scr: 'Scroll',
  }

  const iconName =
    iconNameMap[coinName] ??
    coinName.charAt(0).toUpperCase() + coinName.slice(1).toLowerCase()

  return `/address/${iconName}Icon.svg`
}

/**
 * Get the long name for a coin (e.g., "eth" -> "Ethereum")
 */
function getLongName(coinName: string): string {
  const coinType = coinNameToTypeMap[coinName as CoinName]
  if (coinType === undefined) return coinName.toUpperCase()

  const names = coinTypeToNameMap[coinType]
  // coinTypeToNameMap returns [shortName, longName] or just shortName
  if (Array.isArray(names) && names.length > 1) {
    return names[1]
  }
  return coinName.toUpperCase()
}

/**
 * Build the full coin configuration for a coin name
 */
function buildCoinConfig(coinName: string): CoinConfig | null {
  const coinType = coinNameToTypeMap[coinName as CoinName]
  if (coinType === undefined) return null

  return {
    name: coinName,
    longName: getLongName(coinName),
    coinType,
    icon: getIconPath(coinName),
  }
}

/**
 * All supported coins, sorted with priority coins first, then alphabetically
 */
export const SUPPORTED_COINS: CoinConfig[] = (() => {
  const priorityConfigs = PRIORITY_COINS.map(buildCoinConfig).filter(
    (c): c is CoinConfig => c !== null,
  )

  const otherCoins = COINS_WITH_ICONS.filter(
    (coin) => !PRIORITY_COINS.includes(coin),
  ).sort()

  const otherConfigs = otherCoins
    .map(buildCoinConfig)
    .filter((c): c is CoinConfig => c !== null)

  return [...priorityConfigs, ...otherConfigs]
})()

/**
 * Get a coin configuration by name
 */
export function getCoinByName(name: string): CoinConfig | undefined {
  return SUPPORTED_COINS.find(
    (coin) => coin.name.toLowerCase() === name.toLowerCase(),
  )
}

/**
 * Get a coin configuration by coin type
 */
export function getCoinByCoinType(coinType: number): CoinConfig | undefined {
  return SUPPORTED_COINS.find((coin) => coin.coinType === coinType)
}
