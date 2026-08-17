export const RegistrationProgressBar = ({
  label,
  description,
  progress,
}: {
  label: string
  description?: string
  progress: number
}) => {
  return (
    <div className="flex flex-col gap-1">
      <div className="transition-all duration-300 ease-in-out max-md:px-3">
        <p className="text-base text-ens-blue">{label}</p>
        {description && <p className="text-ens-gray text-sm">{description}</p>}
      </div>

      <div className="relative h-2 w-full overflow-hidden bg-ens-gray-two md:rounded-full">
        <div
          className="absolute h-full bg-ens-blue transition-all duration-500 ease-out md:rounded-l-full"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute inset-0 animate-shimmer bg-linear-to-r from-transparent via-white/20 to-transparent" />
        </div>
      </div>
    </div>
  )
}
