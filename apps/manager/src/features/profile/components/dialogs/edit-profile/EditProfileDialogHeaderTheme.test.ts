import { describe, expect, it } from 'vitest'
import { getEditProfileDialogHeaderStyle } from './EditProfileDialogHeaderTheme'

describe('getEditProfileDialogHeaderStyle', () => {
  it('uses the profile theme color for the edit dialog header nameplate', () => {
    expect(getEditProfileDialogHeaderStyle('#E72A96')).toMatchObject({
      '--theme-color': '#E72A96',
    })
  })

  it('resolves legacy saved theme colors to the updated palette', () => {
    expect(getEditProfileDialogHeaderStyle('#000000')).toMatchObject({
      '--theme-color': '#02293B',
    })
    expect(getEditProfileDialogHeaderStyle('#ED2496')).toMatchObject({
      '--theme-color': '#E72A96',
    })
  })
})
