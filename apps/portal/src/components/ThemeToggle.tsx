import { Monitor } from 'lucide-react'
import { DarkModeIcon, LightModeIcon } from '@/assets/icons'
import { type Theme, useTheme } from '@/hooks/useTheme'
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from './ui/dropdown-menu'

const options: { value: Theme; label: string; icon: React.ReactNode }[] = [
  {
    value: 'light',
    label: 'Light',
    icon: <LightModeIcon className="size-4" />,
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: <DarkModeIcon className="size-4" />,
  },
  { value: 'system', label: 'System', icon: <Monitor className="size-4" /> },
]

const themeIcons: Record<Theme, React.ReactNode> = {
  dark: <DarkModeIcon className="size-4" />,
  light: <LightModeIcon className="size-4" />,
  system: <Monitor className="size-4" />,
}

export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme()

  const currentIcon = themeIcons[theme]

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2">
        {currentIcon}
        Theme
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {options.map(({ value, label, icon }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setTheme(value)}
            className={theme === value ? 'bg-accent' : ''}
          >
            {icon}
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
