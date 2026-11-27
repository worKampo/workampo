// The router can only show our own origin; any other URL (a company subdomain, another site) is a full navigation.
export function inAppPath(url: string): string | undefined {
  const target = new URL(url, window.location.origin)

  // A path starting with // or /\ would name another host when read again as a URL.
  const ours = target.origin === window.location.origin && !/^\/[/\\]/.test(target.pathname)

  return ours ? target.pathname + target.search : undefined
}
