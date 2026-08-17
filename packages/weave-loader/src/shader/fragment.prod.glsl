// Production weave shader — the minimal effect shipped in the live registration loader.
// A grid of warp/weft rounded rects with palette colors, colorways/gradients, a weave-in
// reveal, and an optional shimmer sweep.
//
// This is a trimmed copy of fragment.glsl (the sandbox shader). It deliberately omits the
// sandbox-only systems that the app never enables in production: ENS-mark compositing,
// pointer/hover ripple, and stitch-in reveal. Keep this file lean — if a feature is not
// used by the live loader, it does not belong here.
//
// WebGL 1 / GLSL ES 1.00.
precision mediump float;

// Time and framebuffer
uniform float u_time;              // Seconds since context creation
uniform vec2 u_resolution;         // Canvas size in pixels (for aspect and AA)

// Pattern texture: one strip per pattern, R channel = 0 warp / 1 weft per cell
uniform sampler2D u_patternSampler;
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

// All colorways: u_useAllColorways + u_colorwayNoiseMode — 0 = hash, 1 = smooth Perlin+FBM, 2 = dye bleed (anisotropic FBM).
uniform float u_useAllColorways;
uniform float u_colorwaySeed;
uniform float u_colorwayNoiseScale;
uniform float u_colorwayNoiseMode;       // 0 hash, 1 smooth, 2 dye bleed
uniform float u_colorwayNoiseOctaves;    // 1–4
uniform float u_colorwayNoisePersistence;
uniform float u_colorwayNoiseLacunarity;
uniform float u_colorwayNoiseBias;       // pow exponent on 0..1 before quantize (1 = linear)
uniform float u_colorwayNoiseX;          // cell-space X translation of noise sample
uniform float u_colorwayBleedAnisotropy; // >=1 stretch one axis (bleed along thread)
uniform float u_colorwayBleedRotation;   // 0–1 → full turn (mode 2, non–draft-coupled)
uniform float u_colorwayBleedCrossFiber; // 0–1 mix isotropic FBM
uniform float u_colorwayBleedDraftCoupled; // 1 = streak along warp vs weft from isWeft; 0 = rotation+anisotropy only
// Which palettes 0–4 participate in "all colorways" (1=include).
uniform vec4 u_colorwayInclude0123;
uniform float u_colorwayInclude4;

// Reveal animation: time when current wave started (resets on pattern change)
uniform float u_revealStartTime;
// Rect aspect: width/height in cell space (halfX/halfY). Spec 36×40 → 0.9.
uniform float u_rectAspect;
uniform float u_cornerRadius;     // Rounded rect corner radius in cell space (~0.18 ≈ 6/40)

// --- ROUNDED RECTANGLE SDF ---
float roundedRect(vec2 p, vec2 halfSize, float radius) {
    vec2 d = abs(p) - halfSize + radius;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - radius;
}

// --- WEAVE PATTERN LOOKUP (texture-based) ---
float getPatternFromTexture(float row, float col) {
    float r = mod(row, u_tileH);
    float c = mod(col, u_tileW);
    float stripY = u_patternIndex * 10.0;
    float texX = (c + 0.5) / 10.0;
    float texY = (stripY + r + 0.5) / u_patternTexHeight;
    return texture2D(u_patternSampler, vec2(texX, texY)).r;
}

// --- ENS COLOR PICK (colorway + shade) ---
vec4 getPaletteColor(float palette, float shade) {
    int p = int(mod(floor(palette + 0.01), 5.0));
    int s = int(mod(floor(shade + 0.01), 6.0));
    if (s == 4) return vec4(0.0, 0.0, 0.0, 0.0);  // Transparent
    if (s == 5) return vec4(0.933, 0.933, 0.933, 1.0);  // eee (#eeeeee)
    if (p == 0) { // Citrine
        if (s == 0) return vec4(0.247, 0.114, 0.035, 1.0);
        if (s == 1) return vec4(0.596, 0.302, 0.106, 1.0);
        if (s == 2) return vec4(0.973, 0.969, 0.886, 1.0);
        return vec4(0.855, 0.725, 0.525, 1.0);
    }
    if (p == 1) { // Garnet
        if (s == 0) return vec4(0.322, 0.024, 0.141, 1.0);
        if (s == 1) return vec4(0.941, 0.216, 0.576, 1.0);
        if (s == 2) return vec4(0.984, 0.922, 0.941, 1.0);
        return vec4(0.988, 0.706, 0.812, 1.0);
    }
    if (p == 2) { // Lapis
        if (s == 0) return vec4(0.008, 0.161, 0.231, 1.0);
        if (s == 1) return vec4(0.0, 0.502, 0.737, 1.0);
        if (s == 2) return vec4(0.902, 0.953, 0.973, 1.0);
        return vec4(0.455, 0.725, 0.875, 1.0);
    }
    if (p == 3) { // Peridot
        if (s == 0) return vec4(0.012, 0.188, 0.063, 1.0);
        if (s == 1) return vec4(0.0, 0.486, 0.137, 1.0);
        if (s == 2) return vec4(0.843, 0.914, 0.890, 1.0);
        return vec4(0.4549, 0.6745, 0.4902, 1.0);
    }
    // Quartz (neutral ramp)
    if (s == 0) return vec4(0.098039, 0.098039, 0.098039, 1.0);
    if (s == 1) return vec4(0.34902, 0.341176, 0.333333, 1.0);
    if (s == 2) return vec4(0.933333, 0.929412, 0.929412, 1.0);
    return vec4(0.45098, 0.45098, 0.45098, 1.0);
}

// Hash for deterministic per-cell palette (mode 0) and shimmer shot noise.
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec2 colorwayHash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

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

float colorwayIncludeCount() {
  return u_colorwayInclude0123.x + u_colorwayInclude0123.y + u_colorwayInclude0123.z + u_colorwayInclude0123.w + u_colorwayInclude4;
}

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

void main() {
    // --- GRID SETUP ---
    vec2 uv = gl_FragCoord.xy / u_resolution;
    float aspect = u_resolution.x / u_resolution.y;
    uv.x *= aspect;

    float gridSize = clamp(u_gridSize, 2.0, 256.0);
    vec2 gridUV = uv * gridSize;
    vec2 cellUV = fract(gridUV);
    vec2 cellID = floor(gridUV);

    // --- WEAVE MATRIX LOOKUP ---
    float isWeft = getPatternFromTexture(cellID.y, cellID.x);

    // --- ROUNDED RECT — ORIENT BY WARP/WEFT ---
    vec2 p = cellUV - 0.5;
    float halfY = 0.5;
    float aspectClamped = clamp(u_rectAspect, 0.3, 1.0);
    float halfX = halfY * aspectClamped;
    float cornerRadius = clamp(u_cornerRadius, 0.0, 0.5);
    vec2 halfSize = isWeft > 0.5 ? vec2(halfY, halfX) : vec2(halfX, halfY);
    float d = roundedRect(p, halfSize, cornerRadius);

    float edge = gridSize / min(u_resolution.x, u_resolution.y);
    float cell = 1.0 - smoothstep(-edge, edge, d);

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
      float xMicro = u_colorwayNoiseX * 0.04;
      float cellPalette;
      float mode = u_colorwayNoiseMode;
      if (mode < 0.5) {
        cellPalette = colorwayPickFromU(hash(cellID * scale + vec2(u_colorwaySeed + xMicro, 0.0)));
      } else if (mode < 1.5) {
        vec2 pp = cellID.xy * scale + seedOff;
        cellPalette = colorwayQuantize(colorwayFbm(pp, xMicro));
      } else {
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
    vec4 inRectVec = threadVec.a > 0.001 ? threadVec : vec4(bgVec.rgb, 1.0);

    // --- WEAVE-IN REVEAL ---
    float speedR = 2.0 * gridSize / 1.8;
    float elapsed = u_time - u_revealStartTime;
    float wave = (cellID.x + cellID.y) - elapsed * speedR;
    float reveal = smoothstep(1.0, 0.0, wave);
    cell *= reveal;

    vec4 outColor = mix(bgVec, inRectVec, cell);

    // --- SHIMMER (quantized to each shot/pick; per-shot intensity noise) ---
    if (u_shimmer > 0.5) {
      float speed = max(0.001, u_shimmerSpeed);
      float width = max(0.01, u_shimmerWidth);
      float angle = u_shimmerRotation * 6.28318530718;
      float cosA = cos(angle);
      float sinA = sin(angle);
      float period = gridSize * (aspect * abs(cosA) + abs(sinA));
      period = max(period, 1.0);
      float timeStep = floor(u_shimmerTime * speed);
      float bandCenter = mod(timeStep + u_shimmerPosition * period, period);
      float along = cellID.x * cosA + cellID.y * sinA;
      float phase = mod(along - bandCenter + 0.5 * period, period) - 0.5 * period;
      float dist = abs(phase);
      float band = 1.0 - smoothstep(0.0, width, dist);
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

    gl_FragColor = outColor;
}
