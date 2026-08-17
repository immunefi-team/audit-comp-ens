import '@testing-library/jest-dom'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { ShareProfileDialog } from './ShareProfileDialog'
import { resolveDefaultExport } from './ShareProfileDialog.helpers'

i18n.loadAndActivate({ locale: 'en', messages: {} })

const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

beforeEach(() => {
  mockMatchMedia(true)
})

describe('ShareProfileDialog', () => {
  it('unwraps browser-wrapped default exports before rendering them', () => {
    const component = () => null

    expect(resolveDefaultExport({ default: component })).toBe(component)
  })

  it('keeps direct default exports unchanged', () => {
    const component = () => null

    expect(resolveDefaultExport(component)).toBe(component)
  })

  it('opens the share dialog without crashing', async () => {
    render(
      createElement(
        I18nProvider,
        { i18n },
        createElement(ShareProfileDialog, {
          name: 'bigint.eth',
          url: 'https://app.ens.domains/bigint.eth',
        }),
      ),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Share' }))

    expect(await screen.findByText('Copy Link')).toBeInTheDocument()
  })

  it('renders the new profile sharing card header', async () => {
    render(
      createElement(
        I18nProvider,
        { i18n },
        createElement(ShareProfileDialog, {
          name: 'bigint.eth',
          url: 'https://app.ens.domains/bigint.eth',
        }),
      ),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Share' }))

    expect(await screen.findByText('Share profile link')).toBeInTheDocument()
  })

  it('uses content width for a mobile nameplate without a QR code', async () => {
    mockMatchMedia(false)

    render(
      createElement(
        I18nProvider,
        { i18n },
        createElement(ShareProfileDialog, {
          name: 'alia.eth',
          url: 'https://app.ens.domains/alia.eth',
        }),
      ),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Share' }))

    const nameplate = (await screen.findByText('alia.eth')).parentElement
    const drawer = screen
      .getByText('Share profile link')
      .closest('[data-slot="drawer-content"]')
    const scrollContainer = drawer?.lastElementChild

    expect(nameplate).toHaveClass('w-fit')
    expect(nameplate).not.toHaveClass('w-full')
    expect(drawer).toHaveClass(
      'data-[vaul-drawer-direction=bottom]:max-h-[calc(100dvh-20px)]',
    )
    expect(drawer).toHaveClass('overflow-hidden')
    expect(scrollContainer).toHaveClass('overflow-y-auto')
  })

  it('uses the Figma action tracking and Garnet share button shades', async () => {
    mockMatchMedia(true)

    render(
      createElement(
        I18nProvider,
        { i18n },
        createElement(ShareProfileDialog, {
          name: 'alia.eth',
          themeColor: '#E72A96',
          url: 'https://app.ens.domains/alia.eth',
        }),
      ),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Share' }))

    const copyButton = (await screen.findByText('Copy Link')).closest('button')
    const copyIcon = copyButton?.querySelector('.material-symbol')
    const dialog = screen
      .getByText('Share profile link')
      .closest('[data-slot="dialog-content"]')

    expect(copyButton).toHaveClass('tracking-[0.12em]')
    expect(copyIcon).toHaveClass('tracking-[0.12em]')
    expect(dialog).toHaveStyle({
      '--share-button-bg': '#FFB0D0',
      '--share-button-text': '#5A0024',
    })
  })
})
