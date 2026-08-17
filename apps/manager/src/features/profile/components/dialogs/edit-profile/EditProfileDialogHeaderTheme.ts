import type { CSSProperties } from 'react'
import { getThemeVars } from '@/features/profile/utils/themeColor'

type EditProfileDialogHeaderStyle = CSSProperties &
  Record<'--theme-color', string>

export const getEditProfileDialogHeaderStyle = (
  themeColor?: string | null,
): EditProfileDialogHeaderStyle =>
  getThemeVars(themeColor) as EditProfileDialogHeaderStyle
