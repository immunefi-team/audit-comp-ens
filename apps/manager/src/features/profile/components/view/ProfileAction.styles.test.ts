import { describe, expect, it } from 'vitest'
import { editActionClassName } from './ProfileAction.styles'

describe('ProfileViewAction styles', () => {
  it('uses themed edit button colors on mobile and desktop', () => {
    const classes = editActionClassName.split(' ')

    expect(classes).toEqual(expect.arrayContaining(['border-none']))
    expect(classes).toEqual(
      expect.arrayContaining([
        'bg-(--theme-button-bg)',
        'text-(--theme-button-text)',
        'hover:bg-(--theme-button-hover-bg)',
      ]),
    )
    expect(classes).not.toEqual(
      expect.arrayContaining([
        'bg-white',
        'border-ens-quartz-900',
        'text-ens-quartz-900',
      ]),
    )
  })
})
