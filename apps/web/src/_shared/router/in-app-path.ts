// The router can only show our own origin; any other URL (a company subdomain, another site) is a full navigation.
export function inAppPath(url: string): string | undefined {
  const target = new URL(url, window.location.origin)

  return target.origin === window.location.origin ? target.pathname + target.search : undefined
}
