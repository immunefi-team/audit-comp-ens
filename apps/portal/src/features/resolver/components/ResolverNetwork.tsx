import { NamechainSVG } from '@/assets/chains'

export const ResolverNetwork = () => {
  return (
    <div className="flex flex-row p-4 sm:p-6 gap-4 sm:gap-6 rounded-sm border border-border w-full flex-1 items-center">
      <NamechainSVG />
      <div className="flex flex-col">
        <span className="font-medium">Network</span>
        <span>Sepolia</span>
      </div>
    </div>
  )
}
