/** Skeleton stand-in for the weave track while a lazy chunk loads. */
export function WeaveTrackPlaceholder({ className }: { className?: string }) {
  return (
    <div
      className={`h-[19px] w-full rounded-[2px] bg-ens-gray-two ${className ?? ''}`}
    />
  )
}
