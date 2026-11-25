type Options = {
  mode: 'path' | 'subdomain'
  publicBaseUrl: string
  hostSuffix?: string | undefined
}

// biome-ignore lint/complexity/useMaxParams: slug and path vary per call, the options are the environment's.
export function tenantUrl(
  slug: string,
  path: string,
  { mode, publicBaseUrl, hostSuffix }: Options,
) {
  const tail = path.startsWith('/') ? path : `/${path}`
  if (mode === 'path') return `${publicBaseUrl.replace(/\/+$/, '')}/c/${slug}${tail}`
  if (!hostSuffix) throw new Error('Subdomain mode needs a host suffix')

  return `${new URL(publicBaseUrl).protocol}//${slug}${hostSuffix}/app${tail}`
}
