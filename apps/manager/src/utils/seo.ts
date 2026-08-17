// Cloudflare doesn't expose NODE_ENV, so checking the source branch is our easiest workaround
const IS_PROD = process.env.CF_PAGES_BRANCH === 'master'
// On production builds, CF_PAGES_URL points to a Cloudflare preview URL rather than the production domain.
// We default to ens.domains when CF_PAGES_BRANCH is 'master' OR when CF_PAGES_URL is unset.
export const BASE_URL = new URL(
  (!IS_PROD && process.env.CF_PAGES_URL) || 'https://ens.domains',
)

export const seo = ({
  title,
  description,
  keywords,
  image,
}: {
  title: string
  description?: string
  image?: string
  keywords?: string
}) => {
  const tags = [
    { title },
    { name: 'description', content: description },
    { name: 'keywords', content: keywords },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:creator', content: '@ensdomains' },
    { name: 'twitter:site', content: '@ensdomains' },
    { name: 'og:type', content: 'website' },
    { name: 'og:title', content: title },
    { name: 'og:description', content: description },
    ...(image
      ? [
          { name: 'twitter:image', content: image },
          { name: 'twitter:card', content: 'summary_large_image' },
          { name: 'og:image', content: image },
        ]
      : []),
  ]

  return tags
}
