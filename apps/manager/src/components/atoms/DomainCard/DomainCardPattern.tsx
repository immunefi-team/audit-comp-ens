'use client'

import { memo } from 'react'

interface DomainCardPatternProps {
  variant: 'garnet' | 'lapis' | 'peridot'
  domainName: string
}

const patternColors: Record<
  'garnet' | 'lapis' | 'peridot',
  { core: string; dust: string }
> = {
  garnet: {
    core: 'var(--color-ens-garnet-core)',
    dust: 'var(--color-ens-garnet-dust)',
  },
  lapis: {
    core: 'var(--color-ens-lapis-core)',
    dust: 'var(--color-ens-lapis-dust)',
  },
  peridot: {
    core: 'var(--color-ens-peridot-core)',
    dust: 'var(--color-ens-peridot-dust)',
  },
}

/**
 * DomainCardPattern - Memoized SVG pattern component
 * The idea witht his maybe then we can have a different pattern for each domain
 * need to think about how to do this with the domain name and talk with design team.
 */
export const DomainCardPattern = memo(function DomainCardPattern({
  variant,
  domainName,
}: DomainCardPatternProps) {
  const patternColor = patternColors[variant]

  return (
    <svg
      className="h-full w-full rounded"
      fill="none"
      height="100%"
      preserveAspectRatio="none"
      viewBox="0 0 338 200"
      width="100%"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
    >
      <title>{`${domainName} background pattern`}</title>
      <rect
        fill={`url(#pattern_${variant})`}
        height="200"
        rx="12"
        width="338"
      />
      <defs>
        <pattern
          height="1"
          id={`pattern_${variant}`}
          patternTransform="matrix(148.93 0 0 278.095 54.4387 21.8301)"
          patternUnits="userSpaceOnUse"
          preserveAspectRatio="none"
          viewBox="0 -18.6691 297.859 556.19"
          width="1"
        >
          <use
            transform="translate(-446.789 -278.095)"
            xlinkHref={`#pattern_${variant}_inner`}
          />
          <use
            transform="translate(-148.93 -278.095)"
            xlinkHref={`#pattern_${variant}_inner`}
          />
          <use
            transform="translate(148.93 -278.095)"
            xlinkHref={`#pattern_${variant}_inner`}
          />
          <use
            transform="translate(-595.718 0)"
            xlinkHref={`#pattern_${variant}_inner`}
          />
          <use
            transform="translate(-297.859 0)"
            xlinkHref={`#pattern_${variant}_inner`}
          />
          <g id={`pattern_${variant}_inner`}>
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 -0.965283 0.0658205)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 48.7852 -7.04279)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 68.7969 48.8387)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 37.441 2.75143)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 87.1914 -4.35718)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 107.203 51.5244)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 75.8472 5.4371)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 125.598 -1.67151)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 145.609 54.21)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 211.468 46.1438)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 261.219 39.0352)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 281.23 94.9167)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 114.253 8.12271)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 164.004 1.0141)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 184.016 56.8956)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 249.875 48.8294)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 299.625 41.7208)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 319.637 97.6024)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 191.066 13.4939)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 240.816 6.38531)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 260.828 62.2668)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 229.472 16.1796)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 279.223 9.07098)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 299.234 64.9525)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 288.281 51.515)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 338.031 44.4064)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 358.043 100.288)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 19.4371 32.7157)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 69.1875 25.6071)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 89.1992 81.4886)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 57.8433 35.4013)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 107.594 28.2927)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 127.605 84.1742)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 96.2496 38.0869)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 146 30.9783)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 166.012 86.8599)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 134.656 40.7725)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 184.406 33.6639)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 204.418 89.5455)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 39.8394 65.3655)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 89.5898 58.2569)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 109.602 114.138)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 155.056 73.4224)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 204.807 66.3138)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 224.818 122.195)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 193.462 76.108)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 243.213 68.9994)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 263.225 124.881)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 231.869 78.7937)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 281.619 71.6851)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 301.631 127.567)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 270.275 81.4793)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 320.025 74.3707)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 340.037 130.252)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 308.681 84.1649)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 358.432 77.0563)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 378.443 132.938)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 60.2398 98.0154)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 109.99 90.9068)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 130.002 146.788)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 175.459 106.072)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 225.209 98.9636)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 245.221 154.845)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 213.865 108.758)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 263.615 101.649)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 283.627 157.531)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 252.271 111.444)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 302.021 104.335)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 322.033 160.216)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 290.677 114.129)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 340.428 107.021)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 360.439 162.902)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 329.084 116.815)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 378.834 109.706)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 398.846 165.588)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 80.6421 130.665)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 130.393 123.557)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 150.404 179.438)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 119.048 133.351)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 168.799 126.242)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 188.811 182.124)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 195.861 138.722)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 245.611 131.614)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 265.623 187.495)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 234.267 141.408)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 284.018 134.299)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 304.029 190.181)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 311.08 146.779)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 360.83 139.67)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 380.842 195.552)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 349.486 149.465)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 399.236 142.356)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 419.248 198.238)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 101.044 163.315)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 150.795 156.206)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 170.807 212.088)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 139.451 166.001)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 189.201 158.892)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 209.213 214.774)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 141.847 228.615)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 191.598 221.506)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 211.609 277.388)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 180.253 231.3)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 230.004 224.192)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 250.016 280.073)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 372.285 244.729)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 422.035 237.62)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 442.047 293.501)"
              width="44"
            />
            <rect
              height="26.5"
              rx="13.25"
              stroke={patternColor.core}
              strokeWidth="4"
              transform="matrix(0.997564 0.0697565 0.529919 0.848048 410.691 247.414)"
              width="26.5"
              x="3.05497"
              y="1.83561"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-0.292779 0.572649 -1.09098 -0.629384 460.441 240.306)"
              width="44"
            />
            <rect
              height="18"
              rx="4"
              stroke={patternColor.dust}
              strokeWidth="4"
              transform="matrix(-1.0679 -0.667797 0.368168 -0.527351 480.453 296.187)"
              width="44"
            />
          </g>
          <use
            transform="translate(-446.789 278.095)"
            xlinkHref={`#pattern_${variant}_inner`}
          />
          <use
            transform="translate(-148.93 278.095)"
            xlinkHref={`#pattern_${variant}_inner`}
          />
          <use
            transform="translate(148.93 278.095)"
            xlinkHref={`#pattern_${variant}_inner`}
          />
        </pattern>
      </defs>
    </svg>
  )
})
