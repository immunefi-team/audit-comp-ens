import { Link } from '@tanstack/react-router'
import { LogoSVG, LogoWithTextSVG } from '@/assets/logo'
import { SidebarTrigger } from './ui/sidebar'

export const MobileHeader = () => (
  <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-border sticky top-0 z-10 bg-background">
    <Link to="/">
      <LogoSVG width={35} height={40} className="sm:hidden text-foreground" />
      <LogoWithTextSVG
        width={72}
        height="auto"
        className="hidden sm:block text-foreground"
      />
    </Link>
    <SidebarTrigger />
  </header>
)
