import { Link } from '@tanstack/react-router'
import { LogoSVG, LogoWithTextSVG } from '@/assets/logo'
import { WalletMenu } from '@/components/WalletMenu'

export const HomeHeader = () => (
  <header className="flex flex-col sm:flex-row gap-5 sm:gap-6 sm:items-center sm:justify-center w-full sm:w-auto">
    {/* Mobile: logo mark + connect as a justify-between row.
        Desktop: sm:contents spreads children into parent flex row. */}
    <div className="flex items-center justify-between sm:contents">
      <Link to="/" className="flex items-center sm:order-1">
        <LogoSVG width={35} height={40} className="sm:hidden text-foreground" />
        <LogoWithTextSVG
          width={97}
          height={30}
          className="hidden sm:block text-foreground"
        />
      </Link>
      <div className="sm:order-3">
        <WalletMenu />
      </div>
    </div>

    {/* Explorer + Alpha badge */}
    <div className="sm:order-2 self-center inline-grid place-items-start">
      <span className="col-start-1 row-start-1 text-4xl font-normal text-foreground leading-none">
        Explorer
      </span>
    </div>
  </header>
)
