import * as ImageFallback from '@/components/atoms/ImageFallback'
import { PatternAvatar } from '@/components/atoms/PatternAvatar/PatternAvatar'
import type { NameRowProfilePreview } from '@/features/dashboard/components/nameRowProfileRecords'

/** Square avatar with a generated-pattern fallback, shared across the steps. */
export const NameAvatar = ({
  preview,
  name,
}: {
  readonly preview: NameRowProfilePreview
  readonly name: string
}) => (
  <div className="relative size-9 shrink-0 overflow-hidden rounded-sm bg-ens-quartz-50">
    <ImageFallback.Root className="contents">
      <ImageFallback.Image
        alt=""
        className="size-full object-cover"
        src={preview.avatarUrl}
      />
      <ImageFallback.Fallback>
        <PatternAvatar
          className="size-full rounded-sm border-none bg-transparent p-0 shadow-none"
          color={preview.themeColor}
          name={name}
        />
      </ImageFallback.Fallback>
    </ImageFallback.Root>
  </div>
)
