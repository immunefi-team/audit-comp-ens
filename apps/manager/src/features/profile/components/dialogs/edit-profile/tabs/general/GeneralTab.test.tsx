import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProfileRecords } from '@/features/profile/types'
import { newEmptyProfileRecords } from '@/features/profile/utils/transformRecords'
import { GeneralTab } from './GeneralTab'

const profileImageFieldMock = vi.hoisted(() => ({
  removeHandlers: new Map<string, () => void>(),
  themeColors: new Map<string, string | null | undefined>(),
}))

vi.mock('../../EditProfileDialog.context', () => ({
  useEditProfileDialogActions: () => ({
    showField: vi.fn(),
    toggleField: vi.fn(),
  }),
  useEditProfileDialogStatus: () => ({ isSaving: false }),
  useEditProfileVisibleFields: () => new Set(['avatar', 'header']),
}))

vi.mock('./ProfileImageField', () => ({
  ProfileImageField: ({
    kind,
    onImageRemove,
    themeColor,
  }: {
    readonly kind: string
    readonly onImageRemove: () => void
    readonly themeColor?: string | null
  }) => {
    profileImageFieldMock.removeHandlers.set(kind, onImageRemove)
    profileImageFieldMock.themeColors.set(kind, themeColor)

    return (
      <button
        onClick={() => profileImageFieldMock.removeHandlers.get(kind)?.()}
        type="button"
      >
        remove {kind}
      </button>
    )
  },
}))

const ProfileImageRemovalHarness = () => {
  const [values, setValues] = useState<ProfileRecords>({
    ...newEmptyProfileRecords(),
    base: {
      avatar: 'https://example.com/avatar.png',
      header: 'https://example.com/banner.png',
      theme: '#984D1B',
    },
  })

  return (
    <>
      <GeneralTab
        name="test.eth"
        onBaseChange={(base) =>
          setValues((currentValues) => ({ ...currentValues, base }))
        }
        onContactChange={(contact) =>
          setValues((currentValues) => ({ ...currentValues, contact }))
        }
        preparedImageUploads={[]}
        values={values}
      />
      <output data-testid="base-records">{JSON.stringify(values.base)}</output>
    </>
  )
}

const getBaseRecords = () =>
  JSON.parse(screen.getByTestId('base-records').textContent ?? '{}') as Record<
    string,
    string
  >

describe('GeneralTab image removal', () => {
  beforeEach(() => {
    profileImageFieldMock.removeHandlers.clear()
    profileImageFieldMock.themeColors.clear()
  })

  it('passes the profile theme to the avatar image field', () => {
    render(<ProfileImageRemovalHarness />)

    expect(profileImageFieldMock.themeColors.get('avatar')).toBe('#984D1B')
  })

  it('keeps the avatar removed when removing the banner afterwards', () => {
    render(<ProfileImageRemovalHarness />)

    fireEvent.click(screen.getByRole('button', { name: 'remove avatar' }))
    expect(getBaseRecords()).toEqual({
      avatar: '',
      header: 'https://example.com/banner.png',
      theme: '#984D1B',
    })

    fireEvent.click(screen.getByRole('button', { name: 'remove header' }))

    expect(getBaseRecords()).toEqual({
      avatar: '',
      header: '',
      theme: '#984D1B',
    })
  })
})
