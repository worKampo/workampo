// A build hash or a version; no space, quote, slash or colon, so it can never carry free text or a URL (R1, R2).
export const CLIENT_VERSION = /^[A-Za-z0-9._-]{1,64}$/

export function isClientVersion(value: unknown): value is string {
  return typeof value === 'string' && CLIENT_VERSION.test(value)
}

// A UTC instant to the second, the only form a build date or a minimum takes (R7).
export const BUILD_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/

export function isBuildDate(value: unknown): value is string {
  if (typeof value !== 'string' || !BUILD_DATE.test(value)) return false
  const instant = new Date(value)
  // The round trip refuses dates Date would roll over, such as 2026-02-30.
  return !Number.isNaN(instant.getTime()) && instant.toISOString() === value.replace('Z', '.000Z')
}

// The served version when it is a new one; only compared, never used to build a URL (R2).
export function newVersionServed(own: string, served: unknown): string | undefined {
  return own !== 'dev' && isClientVersion(served) && served !== own ? served : undefined
}

export function isBelowMinimum(ownBuildDate: unknown, minimum: unknown): boolean {
  return (
    isBuildDate(ownBuildDate) &&
    isBuildDate(minimum) &&
    Date.parse(minimum) > Date.parse(ownBuildDate)
  )
}
