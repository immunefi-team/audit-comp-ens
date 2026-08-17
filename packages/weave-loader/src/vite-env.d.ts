/// <reference types="vite/client" />

// GLSL shader sources are imported as raw strings via Vite's `?raw` suffix.
declare module '*.glsl?raw' {
  const src: string
  export default src
}
