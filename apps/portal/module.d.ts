declare module 'virtual:i18next-loader' {
  import type { Resource } from 'i18next'

  const component: Record<string, Resource>
  export default component
}
