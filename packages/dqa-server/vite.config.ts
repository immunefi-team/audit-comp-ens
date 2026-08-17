import { defineConfig } from 'vite'

// Builds client/overlay.js -> dist/overlay.js as an ES module, with
// html-to-image split into its own lazily-fetched chunk.
//
// Why an app-style build (rollupOptions.input) and not `build.lib`: lib mode
// inlines dynamic imports, which would pull html-to-image into the main bundle
// and make it eager. IIFE/UMD output has the same problem — neither format can
// code-split, since there's no module loader to fetch a chunk with.
//
// The server serves dist/ ahead of public/ (see server/index.ts), so the
// public URL stays /overlay.js.
export default defineConfig({
  // public/ holds hand-authored assets (demo.html) that the server serves
  // directly. Without this, Vite would copy them into dist/ as well, so every
  // demo.html edit would need a rebuild to take effect.
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Overlay only ever runs in QA/preview builds, so we target what those
    // browsers actually are rather than a legacy baseline.
    target: 'es2022',
    modulePreload: false,
    rollupOptions: {
      input: 'client/overlay.js',
      output: {
        format: 'es',
        // Stable name: loadOverlay.ts and demo.html both hardcode /overlay.js.
        entryFileNames: 'overlay.js',
        // Hashed: chunks are an implementation detail, referenced only by the
        // entry's own import statement.
        chunkFileNames: 'dqa-[name]-[hash].js',
        assetFileNames: 'dqa-[name]-[hash][extname]',
        // Without this the chunk is named after html-to-image's internal entry
        // path ("es"), producing dqa-es-<hash>.js.
        manualChunks: (id) =>
          id.includes('html-to-image') ? 'capture' : undefined,
      },
    },
  },
})
