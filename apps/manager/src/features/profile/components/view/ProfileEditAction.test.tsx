import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { newEmptyProfileRecords } from '@/features/profile/utils/transformRecords'
import { render } from '@/utils/test-utils'
import { ProfileEditAction } from './ProfileEditAction'

vi.mock(
  '@/features/profile/components/dialogs/edit-profile/EditProfileDialog',
  () => ({
    EditProfileDialog: ({ trigger }: { trigger: React.ReactNode }) => (
      <>{trigger}</>
    ),
  }),
)

const renderAction = (
  props: Partial<React.ComponentProps<typeof ProfileEditAction>>,
) =>
  render(
    <ProfileEditAction
      className="edit"
      isInGrace={false}
      isOwner
      name="stitch.eth"
      onUpdated={() => undefined}
      records={newEmptyProfileRecords()}
      {...props}
    />,
  )

const editButton = () => screen.queryByRole('button', { name: /edit profile/i })

describe('ProfileEditAction', () => {
  it('offers editing for a migrated name the viewer owns', () => {
    renderAction({ protocol: 'v2' })
    expect(editButton()).not.toBeNull()
  })

  it('hides editing on an unmigrated v1 .eth name, whose records cannot be written', () => {
    renderAction({ protocol: 'v1' })
    expect(editButton()).toBeNull()
  })

  it('keeps editing for an imported DNS name, which the v1 registry also serves', () => {
    renderAction({ name: 'example.com', protocol: 'v1' })
    expect(editButton()).not.toBeNull()
  })

  it('keeps editing for an unmigrated .eth subname', () => {
    renderAction({ name: 'sub.stitch.eth', protocol: 'v2' })
    expect(editButton()).not.toBeNull()
  })

  it('hides editing for non-owners', () => {
    renderAction({ isOwner: false, protocol: 'v2' })
    expect(editButton()).toBeNull()
  })

  it('hides editing for names in grace', () => {
    renderAction({ isInGrace: true, protocol: 'v2' })
    expect(editButton()).toBeNull()
  })
})
