export function isBuildDate(value: string): boolean

export function buildVersion(options: {
  env: Record<string, string | undefined>
  run?: (command: string, args: string[]) => string
  root?: string
}): { version: string; buildDate: string }
