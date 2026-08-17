import { Link } from '@tanstack/react-router'
import { NamechainSVG } from '@/assets/chains'

interface TokenLocationProps {
  name: string
}

export const TokenLocation = ({ name }: TokenLocationProps) => {
  return (
    <Link
      to="/$name/resolver"
      params={{ name }}
      className="w-full p-6 border border-border rounded-xl hover:bg-muted duration-150"
    >
      <div className="flex flex-row gap-6 items-center">
        <NamechainSVG height={40} width={40} />
        <div>
          <span className="text-sm text-muted-foreground">Network</span>
          <h3 className="text-foreground">Sepolia</h3>
        </div>
      </div>
    </Link>
  )
}
