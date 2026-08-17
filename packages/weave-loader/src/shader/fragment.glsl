// Weaving draft fragment shader — grid of warp/weft rounded rects, palette colors, gradients, reveal animation.
// Optional stitch-in: ramp u_stitchRevealProgress 0→1 so threads appear from BG-only (Noise = FBM order, Bleed = dye streaks; same math as Mosaic fragmentImageRects).
// WebGL 1 / GLSL ES 1.00. Uniforms set from useShaderSandbox; pattern data from src/patterns/index.js.
precision mediump float;

// Time and framebuffer
uniform float u_time;              // Seconds since context creation
uniform vec2 u_resolution;         // Canvas size in pixels (for aspect and AA)

// Pattern texture: one strip per pattern, R channel = 0 warp / 1 weft per cell
uniform sampler2D u_patternSampler;
// ENS mark (PNG, white on black): `u_ensMarkAspect` = texture width/height so the on-screen rect matches pixels.
uniform sampler2D u_ensMarkSampler;
uniform float u_ensMarkAspect;    // texture width / height (>0)
uniform float u_ensMarkVisible;   // 1 = composite ENS mark; 0 = skip (sidebar / URL)
uniform float u_patternIndex;     // Which strip (pattern) to use
uniform float u_tileW;
uniform float u_tileH;            // Repeat size of this pattern (e.g. 8×8)
uniform float u_patternTexHeight; // Total texture height (10 * numPatterns)

// Colorway and shades (palette 0–4, shade 0–3 per warp/weft/bg)
uniform float u_palette;
uniform float u_bgShade;
uniform float u_warpShade;
uniform float u_weftShade;
uniform float u_gridSize;         // Cells along vertical axis (8–256); higher = finer grid

// Warp/weft 2-stop gradients: start/end RGBA, direction (0 or 1), range (startPos..endPos in 0..1)
uniform vec4 u_warpStart;
uniform vec4 u_warpEnd;
uniform vec4 u_weftStart;
uniform vec4 u_weftEnd;
uniform float u_warpDir;
uniform float u_weftDir;
uniform float u_warpStartPos;
uniform float u_warpEndPos;
uniform float u_weftStartPos;
uniform float u_weftEndPos;
uniform float u_gradSteps;        // 0 or 1 = smooth; >= 2 = discrete bands

// Shimmer: 0 = off, 1 = on. u_shimmerTime drives the band position (pausable); band sweeps over time.
uniform float u_shimmer;
uniform float u_shimmerSpeed;
uniform float u_shimmerTime;      // Time used for shimmer (frozen when paused)
uniform float u_shimmerWidth;
uniform float u_shimmerIntensity;
uniform float u_shimmerPosition;
uniform float u_shimmerRotation;
uniform float u_shimmerNoise;
uniform float u_shimmerNoiseSeed;
uniform float u_shimmerNoiseMin;
uniform float u_shimmerNoiseMax;
uniform float u_shimmerBlendMode;  // 0=Add, 1=Mul, 2=Screen, 3=Overlay, 4=SoftLight, 5=HardLight, 6=ColorDodge, 7=ColorBurn, 8=LinearBurn, 9=Difference, 10=Exclusion

// All colorways: u_useAllColorways + u_colorwayNoiseMode — 0 = hash (legacy), 1 = smooth Perlin+FBM, 2 = dye bleed (anisotropic FBM).
// u_colorwayNoiseScale: spatial scale on cellID (hash and noise).
uniform float u_useAllColorways;
uniform float u_colorwaySeed;
uniform float u_colorwayNoiseScale;
uniform float u_colorwayNoiseMode;       // 0 hash, 1 smooth, 2 dye bleed
uniform float u_colorwayNoiseOctaves;    // 1–4
uniform float u_colorwayNoisePersistence;
uniform float u_colorwayNoiseLacunarity;
uniform float u_colorwayNoiseBias;       // pow exponent on 0..1 before quantize (1 = linear)
uniform float u_colorwayNoiseX;          // cell-space X translation of noise sample (scaled below); was Z slice, now shifts along warp/column axis
uniform float u_colorwayBleedAnisotropy; // >=1 stretch one axis (bleed along thread)
uniform float u_colorwayBleedRotation;   // 0–1 → full turn (mode 2, non–draft-coupled)
uniform float u_colorwayBleedCrossFiber; // 0–1 mix isotropic FBM
uniform float u_colorwayBleedDraftCoupled; // 1 = streak along warp vs weft from isWeft; 0 = rotation+anisotropy only
// Which palettes 0–4 participate in “all colorways” (1=include). All ones = same as legacy mod-5.
uniform vec4 u_colorwayInclude0123;
uniform float u_colorwayInclude4;

// Reveal animation: time when current wave started (resets on pattern change)
uniform float u_revealStartTime;
// Rect aspect: width/height in cell space (halfX/halfY). Spec 36×40 → 0.9. Kept ≤1 so rects fit in cell (no clipping).
uniform float u_rectAspect;
uniform float u_cornerRadius;     // Rounded rect corner radius in cell space (~0.18 ≈ 6/40)

// Stitch-in reveal: 0 = off; 1 = noise (FBM); 2 = bleed (aligned with Mosaic u_stitchReveal*).
uniform float u_stitchRevealMode;
uniform float u_stitchRevealProgress;
uniform float u_stitchRevealSeed;
uniform float u_stitchRevealScale;
uniform float u_stitchRevealNoiseScale;
uniform float u_stitchRevealSoftness;
uniform float u_stitchRevealBleedAnisotropy;
uniform float u_stitchRevealBleedRotation;
uniform float u_stitchRevealBleedCrossFiber;
uniform float u_stitchRevealBleedDraftCoupled;

// Export embed hover interaction (optional): pointer-driven ripple + reveal.
uniform float u_hoverReactive;
uniform float u_hoverRevealOnly;
uniform float u_hoverMovementBoost;
uniform vec2 u_pointerUv;
uniform float u_hoverStrength;
uniform float u_hoverVelocity;
uniform float u_ripplePhase;
uniform float u_rippleWidth;

// ============================================================
// ENS LABS WEAVING DRAFT SHADER
// ============================================================
//
// Atomic unit (Figma ref: ens.domains design system):
//   36×40 px rounded rect, border-radius 6px, fill #0080bc.
//   Aspect ratio width:height = 36:40 (0.9).
//
// This shader recreates the ENS Labs brand pattern system:
// a grid of rounded rectangles that alternate between
// "warp" (horizontal, color 1) and "weft" (vertical, color 2)
// based on a binary weave draft matrix.
//
// ARCHITECTURE:
// 1. Divide canvas into a grid (fract/floor)
// 2. Look up the weave matrix to decide warp vs weft
// 3. Draw a rounded rect SDF per cell
// 4. Color based on warp/weft assignment
//
// WEAVE DRAFT PRIMER:
// In real weaving, the "draft" is a binary grid that tells
// the loom which threads go over/under at each crossing.
// 0 = warp thread on top (horizontal rect)
// 1 = weft thread on top (vertical rect)
// The matrix repeats (tiles) infinitely across the fabric.
// ============================================================


// --- ROUNDED RECTANGLE SDF ---
// A Signed Distance Function returns the distance from point p
// to the nearest edge of the shape.
//   negative = inside the shape
//   zero     = exactly on the edge
//   positive = outside the shape
//
// This lets us draw shapes purely with math — no geometry needed.
// The smoothstep on the result gives us anti-aliased edges.
//
// How it works for a rounded rect:
//   1. abs(p) exploits symmetry — we only need to solve one quadrant
//   2. Subtract halfSize to shift the corner to the origin
//   3. Add radius back, then subtract it from the final distance
//      This effectively "inflates" the sharp corner into a round one

float roundedRect(vec2 p, vec2 halfSize, float radius) {
    vec2 d = abs(p) - halfSize + radius;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - radius;
}


// --- WEAVE PATTERN LOOKUP (texture-based) ---
// Patterns are defined in JS (src/patterns/index.js) and uploaded as a single texture.
// Texture layout: width = 10, height = 10 * numPatterns. Each pattern occupies a 10-row strip.
// u_tileW / u_tileH define the active pattern's repeat size (e.g. 8x8 or 4x10).
// Sample at (col, row + patternIndex*10) to get warp (0) vs weft (1) from R channel.
float getPatternFromTexture(float row, float col) {
    float r = mod(row, u_tileH);
    float c = mod(col, u_tileW);
    float stripY = u_patternIndex * 10.0;
    float texX = (c + 0.5) / 10.0;
    float texY = (stripY + r + 0.5) / u_patternTexHeight;
    return texture2D(u_patternSampler, vec2(texX, texY)).r;
}

// --- ENS COLOR PICK (colorway + shade) ---
// Palette 0–4 = Citrine, Garnet, Lapis, Peridot, Quartz (ENS Core — Quartz uses tokens 900,500,100,400). Shade 0–5 = 950, 500, 100, 400, Transparent, eee.
// Returns sRGB vec4 for the given palette and shade; alpha=0 for Transparent.
vec4 getPaletteColor(float palette, float shade) {
    int p = int(mod(floor(palette + 0.01), 5.0));
    int s = int(mod(floor(shade + 0.01), 6.0));
    if (s == 4) return vec4(0.0, 0.0, 0.0, 0.0);  // Transparent
    if (s == 5) return vec4(0.933, 0.933, 0.933, 1.0);  // eee (#eeeeee)
    if (p == 0) { // Citrine
        if (s == 0) return vec4(0.247, 0.114, 0.035, 1.0);   // 950
        if (s == 1) return vec4(0.596, 0.302, 0.106, 1.0);   // 500
        if (s == 2) return vec4(0.973, 0.969, 0.886, 1.0);   // 100
        return vec4(0.855, 0.725, 0.525, 1.0);               // 400
    }
    if (p == 1) { // Garnet
        if (s == 0) return vec4(0.322, 0.024, 0.141, 1.0);   // 950
        if (s == 1) return vec4(0.941, 0.216, 0.576, 1.0);  // 500
        if (s == 2) return vec4(0.984, 0.922, 0.941, 1.0);  // 100
        return vec4(0.988, 0.706, 0.812, 1.0);               // 400
    }
    if (p == 2) { // Lapis
        if (s == 0) return vec4(0.008, 0.161, 0.231, 1.0);   // 950
        if (s == 1) return vec4(0.0, 0.502, 0.737, 1.0);     // 500
        if (s == 2) return vec4(0.902, 0.953, 0.973, 1.0);   // 100
        return vec4(0.455, 0.725, 0.875, 1.0);               // 400
    }
    if (p == 3) { // Peridot
        if (s == 0) return vec4(0.012, 0.188, 0.063, 1.0);   // 950
        if (s == 1) return vec4(0.0, 0.486, 0.137, 1.0);      // 500
        if (s == 2) return vec4(0.843, 0.914, 0.890, 1.0);   // 100
        return vec4(0.4549, 0.6745, 0.4902, 1.0);             // 300 #74AC7D (slot = UI “400”)
    }
    // Quartz (neutral ramp: 900, 500, 100, 400 — Figma quartz/300 between 100 and 400)
    if (s == 0) return vec4(0.098039, 0.098039, 0.098039, 1.0);   // 900
    if (s == 1) return vec4(0.34902, 0.341176, 0.333333, 1.0);   // 500
    if (s == 2) return vec4(0.933333, 0.929412, 0.929412, 1.0);   // 100
    return vec4(0.45098, 0.45098, 0.45098, 1.0);                  // 400
}

// Hash for deterministic per-cell palette when u_useAllColorways is on (mode 0).
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// vec2 hash for gradient noise (modes 1–2); 2D lattice only (X offset applied in domain of Perlin/FBM).
vec2 colorwayHash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

// 2D gradient noise → ~0..1 for FBM stacking.
float colorwayPerlin01(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  vec2 g00 = colorwayHash22(i + vec2(0.0, 0.0)) * 2.0 - 1.0;
  vec2 g10 = colorwayHash22(i + vec2(1.0, 0.0)) * 2.0 - 1.0;
  vec2 g01 = colorwayHash22(i + vec2(0.0, 1.0)) * 2.0 - 1.0;
  vec2 g11 = colorwayHash22(i + vec2(1.0, 1.0)) * 2.0 - 1.0;
  float n00 = dot(g00, f - vec2(0.0, 0.0));
  float n10 = dot(g10, f - vec2(1.0, 0.0));
  float n01 = dot(g01, f - vec2(0.0, 1.0));
  float n11 = dot(g11, f - vec2(1.0, 1.0));
  float nx = mix(n00, n10, u.x);
  float ny = mix(n01, n11, u.x);
  float n = mix(nx, ny, u.y);
  return clamp(n * 0.65 + 0.5, 0.0, 1.0);
}

// Fractal Brownian motion; `offsetX` shifts sample along cell X per octave (same scaling as former Z slice).
float colorwayFbm(vec2 p, float offsetX) {
  float per = clamp(u_colorwayNoisePersistence, 0.15, 0.95);
  float lac = clamp(u_colorwayNoiseLacunarity, 1.05, 4.0);
  float oct = clamp(floor(u_colorwayNoiseOctaves + 0.01), 1.0, 4.0);
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  float freq = 1.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float w = step(fi + 0.5, oct);
    sum += w * amp * colorwayPerlin01(p * freq + vec2(offsetX * freq, 0.0));
    norm += w * amp;
    amp *= per;
    freq *= lac;
  }
  return sum / max(norm, 1e-4);
}

// Included palette count; if zero, fall back to main u_palette.
float colorwayIncludeCount() {
  return u_colorwayInclude0123.x + u_colorwayInclude0123.y + u_colorwayInclude0123.z + u_colorwayInclude0123.w + u_colorwayInclude4;
}

// Map u01 in [0,1) uniformly to the k-th included palette (order 0…4). Matches legacy floor(u01*5) when all five on.
float colorwayPickFromU(float u01) {
  float n = colorwayIncludeCount();
  if (n < 0.5) return u_palette;
  float kk = floor(clamp(u01, 0.0, 1.0 - 1e-5) * n);
  if (u_colorwayInclude0123.x > 0.5) { if (kk < 0.5) return 0.0; kk -= 1.0; }
  if (u_colorwayInclude0123.y > 0.5) { if (kk < 0.5) return 1.0; kk -= 1.0; }
  if (u_colorwayInclude0123.z > 0.5) { if (kk < 0.5) return 2.0; kk -= 1.0; }
  if (u_colorwayInclude0123.w > 0.5) { if (kk < 0.5) return 3.0; kk -= 1.0; }
  if (u_colorwayInclude4 > 0.5) { if (kk < 0.5) return 4.0; }
  return u_palette;
}

float colorwayQuantize(float tRaw) {
  float b = max(0.08, min(4.0, u_colorwayNoiseBias));
  float t = pow(clamp(tRaw, 0.0, 1.0), b);
  return colorwayPickFromU(t);
}

// 2-stop gradient: t in [0,1], direction flips t, range maps to startPos..endPos.
// u_gradSteps: 0 or 1 = smooth; >= 2 = discrete bands (gradation steps).
vec4 sampleGradient2(vec4 startColor, vec4 endColor, float dir, float startPos, float endPos, float tRaw) {
    float t = (dir > 0.5) ? (1.0 - tRaw) : tRaw;
    float span = endPos - startPos;
    float tGrad = (span < 0.001) ? 0.5 : clamp((t - startPos) / span, 0.0, 1.0);
    if (u_gradSteps >= 2.0) {
        float steps = floor(u_gradSteps);
        tGrad = floor(tGrad * steps) / max(steps - 1.0, 1.0);
    }
    return mix(startColor, endColor, tGrad);
}

// --- Stitch-in (same gradient noise + FBM as fragmentImageRects / Mosaic) ---
vec2 mosaicHash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float mosaicPerlin01(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  vec2 g00 = mosaicHash22(i + vec2(0.0, 0.0)) * 2.0 - 1.0;
  vec2 g10 = mosaicHash22(i + vec2(1.0, 0.0)) * 2.0 - 1.0;
  vec2 g01 = mosaicHash22(i + vec2(0.0, 1.0)) * 2.0 - 1.0;
  vec2 g11 = mosaicHash22(i + vec2(1.0, 1.0)) * 2.0 - 1.0;
  float n00 = dot(g00, f - vec2(0.0, 0.0));
  float n10 = dot(g10, f - vec2(1.0, 0.0));
  float n01 = dot(g01, f - vec2(0.0, 1.0));
  float n11 = dot(g11, f - vec2(1.0, 1.0));
  float nx = mix(n00, n10, u.x);
  float ny = mix(n01, n11, u.x);
  float n = mix(nx, ny, u.y);
  return clamp(n * 0.65 + 0.5, 0.0, 1.0);
}

float mosaicFbm(vec2 p) {
  float per = 0.5;
  float lac = 2.0;
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  float freq = 1.0;
  for (int i = 0; i < 3; i++) {
    sum += amp * mosaicPerlin01(p * freq);
    norm += amp;
    amp *= per;
    freq *= lac;
  }
  return sum / max(norm, 1e-4);
}

float stitchRevealOrderNoise(vec2 cellID) {
  float scale = max(0.001, u_stitchRevealScale);
  float nfreq = max(0.05, u_stitchRevealNoiseScale);
  vec2 seedOff = vec2(u_stitchRevealSeed * 0.103511, u_stitchRevealSeed * 0.097369);
  vec2 p = cellID.xy * scale + seedOff;
  return mosaicFbm(p * nfreq);
}

float stitchRevealOrderBleed(vec2 cellID, float isWeft) {
  float scale = max(0.001, u_stitchRevealScale);
  float nfreq = max(0.05, u_stitchRevealNoiseScale);
  vec2 seedOff = vec2(u_stitchRevealSeed * 0.103511, u_stitchRevealSeed * 0.097369);
  float ani = max(0.35, min(12.0, u_stitchRevealBleedAnisotropy));
  float ang = u_stitchRevealBleedRotation * 6.28318530718;
  float co = cos(ang);
  float si = sin(ang);
  vec2 rc = vec2(co * cellID.x - si * cellID.y, si * cellID.x + co * cellID.y);
  vec2 pRot = vec2(rc.x * ani, rc.y / ani) * scale + seedOff;
  float tStrip = mosaicFbm(pRot * nfreq);
  vec2 pH = vec2(cellID.x * ani, cellID.y / ani) * scale + seedOff;
  vec2 pV = vec2(cellID.x / ani, cellID.y * ani) * scale + seedOff;
  float tH = mosaicFbm(pH * nfreq);
  float tV = mosaicFbm(pV * nfreq);
  float tMix = mix(tH, tV, isWeft);
  float tDraft = u_stitchRevealBleedDraftCoupled > 0.5 ? tMix : tStrip;
  vec2 pIso = cellID.xy * scale + seedOff + vec2(17.13, 23.71);
  float tIso = mosaicFbm(pIso * nfreq);
  float xf = clamp(u_stitchRevealBleedCrossFiber, 0.0, 1.0);
  return mix(tDraft, tIso, xf);
}

void main() {
    // --- GRID SETUP ---
    // Normalize pixel coordinates to 0..1 range
    vec2 uv = gl_FragCoord.xy / u_resolution;

    // Correct for aspect ratio so grid cells are square
    float aspect = u_resolution.x / u_resolution.y;
    uv.x *= aspect;

    // Scale: u_gridSize = number of cells along the vertical axis (8–256).
    // Higher = smaller tiles (finer weave), lower = larger tiles.
    float gridSize = clamp(u_gridSize, 2.0, 256.0);
    vec2 gridUV = uv * gridSize;

    // fract = local position within this cell (0..1)
    // floor = which cell we're in (integer ID)
    vec2 cellUV = fract(gridUV);
    vec2 cellID = floor(gridUV);
    vec2 cellCenter = cellID + vec2(0.5, 0.5);

    // --- WEAVE MATRIX LOOKUP ---
    // Look up the binary matrix to decide: warp or weft?
    // u_patternIndex selects which weave structure (0..N from patterns registry)
    float isWeft = getPatternFromTexture(cellID.y, cellID.x);

    // --- ROUNDED RECT — ORIENT BY WARP/WEFT ---
    // Warp = rect (halfX, halfY); weft = (halfY, halfX). Clamp aspect to 1.0 so rect fits in cell (no crop).
    vec2 p = cellUV - 0.5;

    float halfY = 0.5;
    float aspectClamped = clamp(u_rectAspect, 0.3, 1.0);
    float halfX = halfY * aspectClamped;
    float cornerRadius = clamp(u_cornerRadius, 0.0, 0.5);
    vec2 halfSize = isWeft > 0.5 ? vec2(halfY, halfX) : vec2(halfX, halfY);
    float d = roundedRect(p, halfSize, cornerRadius);

    // Convert distance to a mask: 1.0 inside, 0.0 outside.
    // WebGL 1 has no fwidth(); use ~1 pixel in cell space for AA.
    float edge = gridSize / min(u_resolution.x, u_resolution.y);
    float cell = 1.0 - smoothstep(-edge, edge, d);

    // Pointer-centered ripple in cell-space with quantized response per rounded-rect cell.
    vec2 pointerGrid = vec2(u_pointerUv.x * aspect, u_pointerUv.y) * gridSize;
    float pointerDist = length(cellCenter - pointerGrid);
    float rippleWidth = max(0.02, u_rippleWidth);
    float rippleSignal = 0.0;
    if (u_hoverReactive > 0.5) {
      float wave = sin(pointerDist * 2.7 - u_ripplePhase);
      float wave01 = wave * 0.5 + 0.5;
      float ring = smoothstep(1.0 - rippleWidth, 1.0, wave01);
      float stepped = floor(clamp(ring, 0.0, 0.999) * 4.0) / 3.0;
      rippleSignal = stepped * clamp(u_hoverStrength, 0.0, 1.0);
      if (u_hoverMovementBoost > 0.5) {
        rippleSignal += stepped * clamp(u_hoverVelocity, 0.0, 1.0) * 0.85;
      }
      rippleSignal = clamp(rippleSignal, 0.0, 1.0);
    }

    float revealMul = 1.0;
    if (u_stitchRevealMode > 0.5) {
      float orderT = u_stitchRevealMode < 1.5
        ? stitchRevealOrderNoise(cellID)
        : stitchRevealOrderBleed(cellID, isWeft);
      float soft = max(0.001, u_stitchRevealSoftness);
      revealMul = smoothstep(orderT - soft, orderT + soft, u_stitchRevealProgress);
    }
    cell *= revealMul;

    // --- COLORING ---
    vec4 bgVec = getPaletteColor(u_palette, u_bgShade);
    float numCellsY = gridSize;
    float numCellsX = gridSize * aspect;
    float tWarp = cellID.y / max(numCellsY - 1.0, 1.0);
    float tWeft = cellID.x / max(numCellsX - 1.0, 1.0);
    vec4 warpColor;
    vec4 weftColor;
    if (u_useAllColorways > 0.5) {
      float scale = max(0.001, u_colorwayNoiseScale);
      vec2 seedOff = vec2(u_colorwaySeed * 0.103511, u_colorwaySeed * 0.097369);
      // Subtle motion along cell X (column / warp index direction in grid space); ~0.04× UI value.
      float xMicro = u_colorwayNoiseX * 0.04;
      float cellPalette;
      float mode = u_colorwayNoiseMode;
      if (mode < 0.5) {
        // Mode 0: hash; shift sample along X (xMicro=0 matches legacy h(cellID*scale + vec2(seed,0))).
        cellPalette = colorwayPickFromU(hash(cellID * scale + vec2(u_colorwaySeed + xMicro, 0.0)));
      } else if (mode < 1.5) {
        // Mode 1: isotropic smooth noise + FBM.
        vec2 p = cellID.xy * scale + seedOff;
        cellPalette = colorwayQuantize(colorwayFbm(p, xMicro));
      } else {
        // Mode 2: dye bleed — elongated runs + optional draft coupling + cross-fiber mix.
        float ani = max(0.35, min(12.0, u_colorwayBleedAnisotropy));
        float ang = u_colorwayBleedRotation * 6.28318530718;
        float co = cos(ang);
        float si = sin(ang);
        vec2 rc = vec2(co * cellID.x - si * cellID.y, si * cellID.x + co * cellID.y);
        vec2 pRot = vec2(rc.x * ani, rc.y / ani) * scale + seedOff;
        float tStrip = colorwayFbm(pRot, xMicro);
        vec2 pH = vec2(cellID.x * ani, cellID.y / ani) * scale + seedOff;
        vec2 pV = vec2(cellID.x / ani, cellID.y * ani) * scale + seedOff;
        float tH = colorwayFbm(pH, xMicro);
        float tV = colorwayFbm(pV, xMicro);
        float tMix = mix(tH, tV, isWeft);
        float tDraft = u_colorwayBleedDraftCoupled > 0.5 ? tMix : tStrip;
        vec2 pIso = cellID.xy * scale + seedOff + vec2(17.13, 23.71);
        float tIso = colorwayFbm(pIso, xMicro);
        float xf = clamp(u_colorwayBleedCrossFiber, 0.0, 1.0);
        float tBleed = mix(tDraft, tIso, xf);
        cellPalette = colorwayQuantize(tBleed);
      }
      warpColor = getPaletteColor(cellPalette, u_warpShade);
      weftColor = getPaletteColor(cellPalette, u_weftShade);
    } else {
      warpColor = sampleGradient2(u_warpStart, u_warpEnd, u_warpDir, u_warpStartPos, u_warpEndPos, tWarp);
      weftColor = sampleGradient2(u_weftStart, u_weftEnd, u_weftDir, u_weftStartPos, u_weftEndPos, tWeft);
    }
    vec4 threadVec = mix(warpColor, weftColor, isWeft);
    if (u_hoverReactive > 0.5) {
      vec3 accent = getPaletteColor(u_palette, 3.0).rgb;
      threadVec.rgb = mix(threadVec.rgb, accent, rippleSignal * 0.42);
    }
    // Transparent thread (alpha=0) shows background through
    vec4 inRectVec = threadVec.a > 0.001 ? threadVec : vec4(bgVec.rgb, 1.0);

    // --- ANIMATION ---
    // Weave-in reveal: diagonal wave on load and when pattern changes (u_revealStartTime resets in JS).
    float speed = 2.0 * gridSize / 1.8;
    float elapsed = u_time - u_revealStartTime;
    float wave = (cellID.x + cellID.y) - elapsed * speed;  // Diagonal coord; wave front advances as elapsed grows
    float reveal = smoothstep(1.0, 0.0, wave);            // 1 ahead of wave, 0 behind

    cell *= reveal;
    if (u_hoverReactive > 0.5 && u_hoverRevealOnly > 0.5) {
      float revealByHover = clamp(u_hoverStrength * 0.25 + rippleSignal, 0.0, 1.0);
      cell *= revealByHover;
    }

    vec4 outColor = mix(bgVec, inRectVec, cell);

    // Shimmer: quantized to each shot/pick (discrete steps); per-shot noise on intensity.
    // Band center advances by whole steps (floor(u_time * speed)); period in same units.
    if (u_shimmer > 0.5) {
      float speed = max(0.001, u_shimmerSpeed);
      float width = max(0.01, u_shimmerWidth);
      float angle = u_shimmerRotation * 6.28318530718; // 0–1 → 0–2π
      float cosA = cos(angle);
      float sinA = sin(angle);
      float period = gridSize * (aspect * abs(cosA) + abs(sinA));
      period = max(period, 1.0);
      // Band center advances by whole shots/picks over time (pausable via u_shimmerTime);
      // u_shimmerPosition (0–1) offsets the starting position around the period.
      float timeStep = floor(u_shimmerTime * speed);
      float bandCenter = mod(timeStep + u_shimmerPosition * period, period);
      float along = cellID.x * cosA + cellID.y * sinA;
      float phase = mod(along - bandCenter + 0.5 * period, period) - 0.5 * period;
      float d = abs(phase);
      float band = 1.0 - smoothstep(0.0, width, d);
      float seedOff = u_shimmerNoiseSeed * 43758.5453;
      float shotNoise = hash(vec2(floor(along) + seedOff, timeStep));
      float noiseAmount = max(0.0, u_shimmerNoise);
      float rawFactor = 1.0 + (shotNoise - 0.5) * 2.0 * noiseAmount;
      float nMin = clamp(u_shimmerNoiseMin, 0.0, 2.0);
      float nMax = clamp(u_shimmerNoiseMax, 0.0, 2.0);
      float noiseFactor = clamp(rawFactor, min(nMin, nMax), max(nMin, nMax));
      float blendFactor = band * u_shimmerIntensity * noiseFactor;
      int mode = int(clamp(u_shimmerBlendMode, 0.0, 10.0) + 0.5);
      vec3 o = outColor.rgb;
      if (mode == 0) {
        outColor.rgb += blendFactor;
      } else if (mode == 1) {
        outColor.rgb *= 1.0 - blendFactor;
      } else if (mode == 2) {
        outColor.rgb = 1.0 - (1.0 - o) * (1.0 - blendFactor);
      } else if (mode == 3) {
        outColor.rgb = mix(o * (1.0 + blendFactor), o + blendFactor * (1.0 - o), step(0.5, o));
      } else if (mode == 4) {
        outColor.rgb = o + blendFactor * o * (1.0 - o);
      } else if (mode == 5) {
        outColor.rgb = mix(2.0 * o * blendFactor, blendFactor + o * (1.0 - blendFactor), step(0.5, o));
      } else if (mode == 6) {
        outColor.rgb = min(vec3(1.0), o / (1.0 - blendFactor + 1e-6));
      } else if (mode == 7) {
        outColor.rgb = max(vec3(0.0), 1.0 - (1.0 - o) / (blendFactor + 1e-6));
      } else if (mode == 8) {
        outColor.rgb = max(vec3(0.0), o + blendFactor - 1.0);
      } else if (mode == 9) {
        outColor.rgb = abs(o - blendFactor);
      } else {
        outColor.rgb = o + blendFactor - 2.0 * o * blendFactor;
      }
    }

    if (u_hoverReactive > 0.5 && u_hoverRevealOnly > 0.5) {
      // In reveal-only mode keep background transparent so tiles appear only on interaction.
      outColor.a = cell;
    }

    // ENS mark: top-left; max(drawW,drawH) = 1.8% canvas diagonal (12% of former 15%×diag reference); aspect = u_ensMarkAspect (w/h) matches PNG.
    if (u_ensMarkVisible > 0.5) {
      vec2 px = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
      float diag = length(u_resolution);
      float S = 0.09 * diag;
      float a = max(0.001, u_ensMarkAspect);
      float drawW = a >= 1.0 ? S : S * a;
      float drawH = a >= 1.0 ? S / a : S;
      float inset = max(1.0, min(S * 0.12, diag * 0.01));
      vec2 origin = vec2(inset, inset);
      vec2 q = (px - origin) / vec2(drawW, drawH);
      if (q.x >= 0.0 && q.x <= 1.0 && q.y >= 0.0 && q.y <= 1.0) {
        vec4 sm = texture2D(u_ensMarkSampler, vec2(1.0 - q.x, 1.0 - q.y));
        float lum = dot(sm.rgb, vec3(0.299, 0.587, 0.114));
        float cover = smoothstep(0.2, 0.92, lum) * sm.a;
        vec3 logoRgb = vec3(1.0);
        outColor.rgb = mix(outColor.rgb, logoRgb, cover);
      }
    }

    gl_FragColor = outColor;
}
