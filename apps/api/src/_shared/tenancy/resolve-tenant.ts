import { slugSchema } from '@workampo/domain/_shared/slug'

const PATH_SLUG = /^\/(?:api\/t|c)\/([^/]+)(?:\/|$)/

// The tenant comes only from the path or the host, never from a header, the body or the query.
export function resolveTenant(
  url: string,
  { mode, hostSuffix }: { mode: 'path' | 'subdomain'; hostSuffix?: string | undefined },
): string | null {
  const { hostname, pathname } = new URL(url)
  const slug = mode === 'path' ? PATH_SLUG.exec(pathname)?.[1] : subdomain(hostname, hostSuffix)

  return slug !== undefined && slugSchema.safeParse(slug).success ? slug : null
}

function subdomain(hostname: string, hostSuffix: string | undefined) {
  if (!(hostSuffix && hostname.endsWith(hostSuffix))) return undefined

  return hostname.slice(0, -hostSuffix.length)
}
