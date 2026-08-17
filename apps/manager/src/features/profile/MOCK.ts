import { zeroAddress } from 'viem'
import type { ProfileRecordsResult } from './service/profileRecords'

export const DEBUG_PROFILE: ProfileRecordsResult = {
  texts: [
    // Base records
    { key: 'email', value: 'debug@ens.domains' },
    { key: 'url', value: 'https://myportfolio.com' },
    {
      key: 'avatar',
      value: 'https://euc.li/enslabs.eth',
    },
    {
      key: 'description',
      value:
        'Ethereum enthusiast and product designer building the future of decentralized web.',
    },
    { key: 'keywords', value: 'ENS,web3,developer,ethereum' },
    // Social records
    { key: 'com.twitter', value: 'enslabs' },
    { key: 'com.github', value: 'enslabs' },
    { key: 'com.discord', value: 'enslabs' },
    { key: 'com.reddit', value: 'enslabs' },
    { key: 'com.telegram', value: 'enslabs' },
    { key: 'com.linkedin', value: 'enslabs' },
    { key: 'com.instagram', value: 'enslabs' },
    // Contact records
    { key: 'location', value: 'New York, NY' },
    { key: 'phone', value: '+1-555-123-4567' },
    { key: 'mail', value: 'PO Box 123, New York, NY 10001' },
    // Links (as JSON string)
    {
      key: 'links',
      value: JSON.stringify([
        { name: 'Blog', url: 'https://ens.domains/blog' },
        {
          name: 'Brand',
          url: 'https://brand.ens.domains',
        },
        {
          name: 'ENS Labs',
          url: 'https://enslabs.org',
        },
      ]),
    },
    // Unknown/custom records
    { key: 'custom.record', value: 'custom value' },
  ],
  coins: [
    // ETH (coinType 60)
    {
      coinType: 60,
      value: '0x1234567890abcdef1234567890abcdef12345678',
      symbol: 'ETH',
    },
    // BTC (coinType 0)
    {
      coinType: 0,
      value: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      symbol: 'BTC',
    },
    // LTC (coinType 2)
    {
      coinType: 2,
      value: 'ltc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      symbol: 'LTC',
    },
    // DOGE (coinType 3)
    {
      coinType: 3,
      value: 'D7Y55w9F1Q6gkQwQ6gkQwQ6gkQwQ6gkQwQ',
      symbol: 'DOGE',
    },
    // SOL (coinType 501)
    {
      coinType: 501,
      value: '4Nd1mYQwQ6gkQwQ6gkQwQ6gkQwQ6gkQwQ6gkQwQ6gkQwQ',
      symbol: 'SOL',
    },
  ],
  resolverAddress: zeroAddress,
}
