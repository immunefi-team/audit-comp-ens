import { describe, expect, it } from 'vitest'
import { cleanResolverTextRecords } from './cleanResolverTextRecords'

describe('cleanResolverTextRecords', () => {
  it('migrates legacy Twitter and GitHub keys', () => {
    expect(
      cleanResolverTextRecords([
        { key: 'vnd.twitter', value: 'ensdomains' },
        { key: 'vnd.github', value: 'ensdomains' },
      ]),
    ).toEqual([
      { key: 'com.twitter', value: 'ensdomains' },
      { key: 'com.github', value: 'ensdomains' },
    ])
  })

  it.each([
    ['https://twitter.com/she_256', 'she_256'],
    ['http://www.twitter.com/she_256/', 'she_256'],
    ['mobile.twitter.com/she_256/', 'she_256'],
    ['https://x.com/@she_256?lang=en', 'she_256'],
    ['m.x.com/she_256/', 'she_256'],
    ['  @she_256  ', 'she_256'],
  ])('normalizes Twitter value %s', (value, expected) => {
    expect(cleanResolverTextRecords([{ key: 'com.twitter', value }])).toEqual([
      { key: 'com.twitter', value: expected },
    ])
  })

  it.each([
    ['https://github.com/rainbow-me/rainbow', 'rainbow-me'],
    ['http://www.github.com/ensdomains/', 'ensdomains'],
    ['mobile.github.com/ensdomains/', 'ensdomains'],
    ['  @ensdomains  ', 'ensdomains'],
  ])('normalizes GitHub value %s', (value, expected) => {
    expect(cleanResolverTextRecords([{ key: 'com.github', value }])).toEqual([
      { key: 'com.github', value: expected },
    ])
  })

  it('prefers canonical records when legacy and canonical keys coexist', () => {
    expect(
      cleanResolverTextRecords([
        { key: 'vnd.twitter', value: 'legacy-twitter' },
        { key: 'com.twitter', value: 'https://x.com/canonical-twitter/' },
        { key: 'com.github', value: 'canonical-github' },
        { key: 'vnd.github', value: 'legacy-github' },
      ]),
    ).toEqual([
      { key: 'com.twitter', value: 'canonical-twitter' },
      { key: 'com.github', value: 'canonical-github' },
    ])
  })

  it('leaves unrelated records unchanged', () => {
    const records = [
      { key: 'url', value: 'https://twitter.com/she_256' },
      { key: 'description', value: '  spaced value  ' },
    ]

    expect(cleanResolverTextRecords(records)).toEqual(records)
  })
})
