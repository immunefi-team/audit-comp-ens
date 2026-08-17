import type { ComponentProps, ReactNode } from 'react'
import { useId } from 'react'
import { cn } from '@/lib/utils'
import { tw } from '@/utils/tailwind'

/**
 * A repeating weave pattern SVG background.
 */
export const BgPattern = (props: React.SVGProps<SVGSVGElement>) => {
  const id = useId()
  return (
    <svg
      fill="none"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      role="presentation"
      viewBox="0 0 200 200"
      width="100%"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <defs>
        <pattern
          height="200"
          id={`bg-weave-pattern-${id}`}
          patternContentUnits="userSpaceOnUse"
          patternTransform="scale(0.0156)"
          patternUnits="userSpaceOnUse"
          width="200"
        >
          <rect fill="currentColor" height="40" width="40" x="160" />
          <rect fill="currentColor" height="40" width="40" x="80" y="40" />
          <rect fill="currentColor" height="40" width="40" y="80" />
          <rect fill="currentColor" height="40" width="40" x="120" y="120" />
          <rect fill="currentColor" height="40" width="40" x="40" y="160" />
        </pattern>
      </defs>
      <rect fill={`url(#bg-weave-pattern-${id})`} height="100%" width="100%" />
    </svg>
  )
}

export const Sparkle = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      fill="none"
      height="53"
      role="presentation"
      viewBox="0 0 43 53"
      width="43"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M20.0304 11.2012C20.3057 11.2012 20.4444 11.0399 20.5142 10.7862C21.2282 6.93707 21.183 6.84463 25.1934 6.08444C25.4687 6.03822 25.631 5.87793 25.631 5.6006C25.631 5.32426 25.4697 5.16298 25.1924 5.11676C21.2056 4.31035 21.3206 4.21791 20.5142 0.414022C20.4454 0.161282 20.3067 0 20.0304 0C19.754 0 19.6154 0.161282 19.5456 0.414022C18.7391 4.21791 18.8768 4.30936 14.8674 5.11676C14.6137 5.16199 14.4288 5.32328 14.4288 5.6006C14.4288 5.87694 14.6137 6.03822 14.8664 6.08444C18.8778 6.89085 18.8316 6.93707 19.5456 10.7862C19.6144 11.0399 19.754 11.2012 20.0304 11.2012ZM8.87442 27.0589C9.31204 27.0589 9.61199 26.7826 9.65821 26.3676C10.4872 20.2133 10.6947 20.2133 17.0565 18.9919C17.4715 18.923 17.7715 18.6457 17.7715 18.2081C17.7715 17.7931 17.4715 17.4941 17.0565 17.4243C10.6947 16.5491 10.4646 16.3416 9.65821 10.0722C9.61199 9.65723 9.31204 9.35728 8.87442 9.35728C8.45941 9.35728 8.15947 9.65722 8.11325 10.0948C7.35306 16.2717 7.0305 16.2491 0.714949 17.4243C0.299944 17.5168 0 17.7931 0 18.2081C0 18.6693 0.299944 18.923 0.806408 18.9919C7.07672 20.0058 7.35306 20.1671 8.11325 26.3213C8.15947 26.7826 8.45941 27.0589 8.87442 27.0589ZM24.501 52.5748C25.1009 52.5748 25.5385 52.1362 25.6536 51.5137C27.29 38.8836 29.0651 36.9699 41.5575 35.5872C42.2027 35.5183 42.6413 35.0345 42.6413 34.4346C42.6413 33.8347 42.2027 33.3745 41.5575 33.282C29.0651 31.8993 27.29 29.9866 25.6536 17.3555C25.5385 16.733 25.1009 16.318 24.501 16.318C23.9011 16.318 23.4645 16.733 23.3721 17.3555C21.7356 29.9866 19.9379 31.8993 7.46812 33.282C6.79939 33.3745 6.36177 33.8357 6.36177 34.4346C6.36177 35.0345 6.79939 35.5183 7.46812 35.5872C19.9143 37.2236 21.6432 38.9062 23.3721 51.5137C23.4645 52.1362 23.9021 52.5748 24.501 52.5748Z"
        fill="#49ABD9"
        fillOpacity="0.5"
      />
    </svg>
  )
}

/**
 * A scalable chat bubble with a smooth curved tail at the bottom-left.
 * Based on the ENS design language.
 */
export const ChatBubble = ({
  children,
  className,
  kind = 'message',
  ...props
}: {
  children: ReactNode
  className?: string
  kind?: 'message' | 'reply'
} & Omit<ComponentProps<'div'>, 'children'>) => {
  // Tail dimensions (from the original SVG design)
  const tailWidth = 21
  const tailHeight = 14

  return (
    <div
      className={cn('relative inline-block', className)}
      style={{ marginBottom: tailHeight }}
      {...props}
    >
      {/* Main bubble */}
      <div
        className={tw`rounded-sm px-4 py-3 font-medium text-sm leading-ens-tight shadow-sm md:text-lg ${kind === 'message' ? 'bg-ens-white text-ens-gray' : 'bg-ens-lapis-core text-ens-white'}`}
      >
        {children}
      </div>

      {/* Tail SVG - positioned at the bottom */}
      <svg
        aria-hidden="true"
        className={cn(
          'absolute top-full',
          kind === 'message' ? 'left-3' : 'right-3 -scale-x-100',
        )}
        fill="none"
        height={tailHeight}
        style={{ marginTop: -0.5 }}
        viewBox="0 0 21 14"
        width={tailWidth} // Slight overlap to prevent gap
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* 
          Path extracted from original design's tail portion.
          Starts at top-left, curves down into stem, curves at tip,
          then diagonals back up to top-right edge.
        */}
        <path
          className={
            kind === 'message' ? 'fill-ens-white' : 'fill-ens-lapis-core'
          }
          d="M0 0C1.4386 0 2.6048 1.1662 2.6048 2.6048V9.9616C2.6048 12.2534 5.3511 13.4281 7.0085 11.8453L18.6574 0.721C19.142 0.2582 19.7863 0 20.4563 0Z"
        />
      </svg>
    </div>
  )
}
