export const TILE_MAX = 10

export interface WeavePattern {
  id: string
  name: string
  tileW: number
  tileH: number
  rows: number[][]
}

function row8(v: number): number[] {
  const a: number[] = []
  for (let c = 0; c < 8; c++) a.push((v >> c) & 1)
  return a
}

export const PATTERNS: WeavePattern[] = [
  {
    id: 'plain',
    name: 'Plain Weave',
    tileW: 2,
    tileH: 2,
    rows: [170, 85, 170, 85, 170, 85, 170, 85].map((v) => row8(v)),
  },
  {
    id: 'matt-rib-irregular',
    name: 'Matt Rib Weave Irregular',
    tileW: 4,
    tileH: 4,
    rows: [3, 12, 6, 9, 12, 3, 9, 6].map((v) => row8(v)),
  },
  {
    id: 'weft-rib-regular',
    name: 'Weft Rib Weave Regular',
    tileW: 3,
    tileH: 1,
    rows: [219, 219, 219, 219, 219, 219, 219, 219].map((v) => row8(v)),
  },
  {
    id: 'satin',
    name: 'Satin Weave',
    tileW: 5,
    tileH: 5,
    rows: [33, 132, 16, 66, 8, 33, 132, 16, 66, 8].map((v) => row8(v)),
  },
  {
    id: 'sateen',
    name: 'Sateen Weave',
    tileW: 5,
    tileH: 5,
    rows: [17, 136, 34, 80, 4, 17, 136, 34, 80, 4].map((v) => row8(v)),
  },
  {
    id: 'twill-2-2',
    name: '2/2 Twill Weave',
    tileW: 4,
    tileH: 4,
    rows: [51, 102, 204, 153, 51, 102, 204, 153].map((v) => row8(v)),
  },
  {
    id: 'twill-3-3',
    name: '3/3 Twill Weave',
    tileW: 6,
    tileH: 6,
    rows: [7, 14, 28, 56, 49, 35, 7, 14, 28, 56].map((v) => row8(v)),
  },
  {
    id: 'weft-rib-irregular',
    name: 'Weft Rib Weave Irregular',
    tileW: 4,
    tileH: 4,
    rows: [6, 2, 14, 2].map((v) => row8(v)),
  },
  {
    id: 'warp-rib-regular',
    name: 'Warp Rib Weave Regular',
    tileW: 3,
    tileH: 3,
    rows: [51, 51, 204, 51, 51, 204, 51, 51].map((v) => row8(v)),
  },
  {
    id: 'warp-rib-irregular',
    name: 'Warp Rib Weave Irregular',
    tileW: 4,
    tileH: 4,
    rows: [51, 204, 51, 204, 204, 51, 204, 51].map((v) => row8(v)),
  },
  {
    id: 'basket',
    name: 'Basket Weave',
    tileW: 4,
    tileH: 4,
    rows: [3, 3, 12, 12, 3, 3, 12, 12].map((v) => row8(v)),
  },
  {
    id: 'point-twill',
    name: 'Point Twill Weave',
    tileW: 8,
    tileH: 8,
    rows: [51, 102, 204, 153, 153, 204, 102, 51].map((v) => row8(v)),
  },
  {
    id: 'royal-oxford',
    name: 'Royal Oxford Weave',
    tileW: 6,
    tileH: 6,
    rows: [3, 3, 12, 9, 6, 24].map((v) => row8(v)),
  },
  {
    id: 'houndstooth',
    name: 'Houndstooth Weave',
    tileW: 8,
    tileH: 8,
    rows: [195, 150, 60, 105, 60, 105, 195, 150].map((v) => row8(v)),
  },
  {
    id: 'herringbone',
    name: 'Herringbone Weave',
    tileW: 8,
    tileH: 8,
    rows: [51, 102, 204, 153, 153, 204, 102, 51].map((v) => row8(v)),
  },
  {
    id: 'pattern-738',
    name: '738 (Diagonal Plus & Dots)',
    tileW: 6,
    tileH: 6,
    rows: [6, 7, 18, 17, 56, 20].map((v) => row8(v)),
  },
  {
    id: 'ens-vertical-pairs',
    name: 'ENS Vertical Pairs',
    tileW: 4,
    tileH: 10,
    rows: [row8(3), row8(9), ...Array.from({ length: 8 }, () => row8(12))],
  },
  {
    id: 'curtain',
    name: 'Curtain',
    tileW: 4,
    tileH: 10,
    rows: [15, 9, 6, 9, 6, 9, 6, 9, 6, 15].map((v) => row8(v)),
  },
]

export interface PatternTexture {
  data: Uint8Array
  width: number
  height: number
}

export function buildPatternTexture(
  patterns: WeavePattern[] = PATTERNS,
): PatternTexture {
  const w = TILE_MAX
  const h = TILE_MAX * Math.max(1, patterns.length)
  const data = new Uint8Array(w * h * 4)
  patterns.forEach((pat, pi) => {
    const baseY = pi * TILE_MAX
    for (let row = 0; row < pat.tileH; row++) {
      const r = pat.rows[row] ?? []
      for (let col = 0; col < pat.tileW; col++) {
        const v = r[col] ? 255 : 0
        const i = (baseY + row) * w * 4 + col * 4
        data[i] = v
        data[i + 1] = v
        data[i + 2] = v
        data[i + 3] = 255
      }
    }
  })
  return { data, width: w, height: h }
}
