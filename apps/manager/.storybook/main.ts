// NOTE: The main Storybook config file (main.ts) does not support TypeScript path aliases (from tsconfig).
// You can use path aliases in preview.tsx and in stories, but not here.

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineMain } from '@storybook/tanstack-react/node'
import type { PluginOption } from 'vite'
import { MATERIAL_SYMBOLS_URL } from '../src/components/ui/material-symbol'

const MONOREPO_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../..',
)

const isCloudflarePlugin = (plugin: PluginOption): boolean => {
  if (Array.isArray(plugin)) {
    return plugin.some(isCloudflarePlugin)
  }
  if (typeof plugin !== 'object' || plugin === null || !('name' in plugin)) {
    return false
  }
  const name = plugin.name
  return typeof name === 'string' && name.includes('cloudflare')
}

export default defineMain({
  stories: [
    '../src/**/*.mdx',
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    '../../../packages/weave-loader/src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: [],
  framework: '@storybook/tanstack-react',
  previewHead: (head) => `
    ${head}
    <link rel="stylesheet" href="${MATERIAL_SYMBOLS_URL}" />
  `,
  async viteFinal(config) {
    const filterCloudflarePlugins = (plugins: PluginOption[]): PluginOption[] =>
      plugins
        .map((plugin) =>
          Array.isArray(plugin) ? filterCloudflarePlugins(plugin) : plugin,
        )
        .filter((plugin) => !isCloudflarePlugin(plugin))
    return {
      ...config,
      plugins: config.plugins
        ? filterCloudflarePlugins(config.plugins)
        : config.plugins,
      server: {
        ...config.server,
        fs: {
          ...config.server?.fs,
          allow: [...(config.server?.fs?.allow ?? []), MONOREPO_ROOT],
        },
      },
    }
  },
})
