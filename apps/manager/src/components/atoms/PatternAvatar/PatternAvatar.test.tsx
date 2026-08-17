import { generatePatternDataURI } from '@ensdomains/etherloom'
import { describe, expect, it } from 'vitest'

import { render } from '@/utils/test-utils'
import { PatternAvatar } from './PatternAvatar'

const etherloomOptions = {
  cellSize: 10,
  height: 96,
  width: 96,
  padding: 10,
} as const
const defaultEtherloomColor = '#0082BB'

const getExpectedPatternSrc = (name: string) =>
  generatePatternDataURI(
    name,
    'ENS Vertical Pairs',
    defaultEtherloomColor,
    etherloomOptions,
  )

const getImageSrc = (container: HTMLElement) =>
  container.querySelector('img')?.getAttribute('src')

describe('PatternAvatar', () => {
  it('renders an accessible Etherloom pattern image', () => {
    const { container, getByRole } = render(
      <PatternAvatar name="vitalik.eth" />,
    )

    const image = getByRole('img', { name: 'vitalik.eth pattern' })

    expect(image).toHaveAttribute('src', getExpectedPatternSrc('vitalik.eth'))
    expect(container.querySelector('svg')).not.toBeInTheDocument()
  })

  it('is deterministic for the same name', () => {
    const first = render(<PatternAvatar name="coderoaster.eth" />)
    const firstSrc = getImageSrc(first.container)
    first.unmount()

    const second = render(<PatternAvatar name="coderoaster.eth" />)
    const secondSrc = getImageSrc(second.container)

    expect(secondSrc).toEqual(firstSrc)
  })

  it('changes image for a different name', () => {
    const first = render(<PatternAvatar name="coderoaster.eth" />)
    const second = render(<PatternAvatar name="ens.eth" />)

    expect(getImageSrc(second.container)).not.toEqual(
      getImageSrc(first.container),
    )
  })
})
