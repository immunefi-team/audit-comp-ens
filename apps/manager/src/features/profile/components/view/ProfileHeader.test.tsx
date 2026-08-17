import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { newEmptyProfileRecords } from '@/features/profile/utils/transformRecords'
import { render } from '@/utils/test-utils'
import { ProfileHeader } from './ProfileHeader'

describe('ProfileHeader', () => {
  it('uses the default Lapis background when no profile theme is set', () => {
    render(
      <ProfileHeader
        avatarLoading={false}
        name="example.eth"
        records={newEmptyProfileRecords()}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'example.eth' }).parentElement,
    ).toHaveClass('bg-[var(--theme-color,var(--color-ens-lapis-500))]')
  })

  it('keeps the mobile About section clear of the profile actions', () => {
    render(
      <ProfileHeader
        avatarLoading={false}
        name="example.eth"
        records={newEmptyProfileRecords()}
      />,
    )

    const aboutContainer = screen
      .getByRole('heading', { name: 'About' })
      .closest('section')?.parentElement

    expect(aboutContainer).toHaveClass('mt-29', 'lg:landscape:mt-0')
  })
})
