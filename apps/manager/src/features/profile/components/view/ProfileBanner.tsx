import * as ImageFallback from '@/components/atoms/ImageFallback'

type ProfileBannerProps = {
  readonly defaultHeaderUrl: string
  readonly headerLoading: boolean
  readonly headerUrl?: string
  readonly name: string
}

export const ProfileBanner = ({
  defaultHeaderUrl,
  headerLoading,
  headerUrl,
  name,
}: ProfileBannerProps) => (
  <div className="relative h-74 w-full lg:landscape:h-90.25">
    <div className="absolute inset-0 overflow-hidden">
      <ImageFallback.Root className="contents">
        <ImageFallback.Image
          alt={`${name} banner`}
          className="absolute top-14 h-60 w-full object-cover lg:landscape:top-0 lg:landscape:h-130"
          src={headerUrl}
        />
        <ImageFallback.Fallback>
          <img
            alt=""
            aria-hidden="true"
            className="absolute top-14 h-60 w-full object-cover lg:landscape:top-0 lg:landscape:h-130"
            src={defaultHeaderUrl}
          />
          {headerLoading ? (
            <div className="absolute inset-0 animate-pulse bg-white/30" />
          ) : null}
        </ImageFallback.Fallback>
      </ImageFallback.Root>
    </div>
    <div className="mask-[linear-gradient(to_bottom,transparent_0%,transparent_54%,black_78%,black_100%)] pointer-events-none absolute inset-x-0 -bottom-10 h-62.5 bg-[linear-gradient(to_bottom,rgba(252,251,251,0)_0%,rgba(252,251,251,0)_40%,rgba(252,251,251,0.72)_72%,#FCFBFB_100%)] backdrop-blur-sm" />
  </div>
)
