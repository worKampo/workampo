import { z } from 'zod'

export const RESERVED_SLUGS: readonly string[] = [
  'admin',
  'api',
  'app',
  'assets',
  'bo',
  'c',
  'docs',
  'health',
  'l',
  'legal',
  'login',
  'mail',
  'static',
  'status',
  'stg',
  'www',
  'workampo',
]

export const SLUG_MIN = 3
export const SLUG_MAX = 40

const FORMAT = /^[a-z0-9]+(-[a-z0-9]+)*$/

export type SlugProblem = 'invalid' | 'reserved'

export function slugProblem(slug: string): SlugProblem | null {
  if (
    slug.length < SLUG_MIN ||
    slug.length > SLUG_MAX ||
    !FORMAT.test(slug) ||
    slug.endsWith('-stg')
  )
    return 'invalid'

  return RESERVED_SLUGS.includes(slug) ? 'reserved' : null
}

export const slugSchema = z.string().refine((slug) => slugProblem(slug) === null)

export function proposeSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/, '')
}
