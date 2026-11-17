// Validates project.yaml (ADR-0045). Run by `pnpm check`.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { z } from 'zod'

// Shapes of real credentials; the profile only names secrets (ADR-0043, ADR-0064).
const SECRET_SHAPES = [
  /gh[pousr]_[A-Za-z0-9]{20,}/,
  /github_pat_/,
  /\b(sk|rk|pk)_(live|test)_/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b[A-Za-z0-9+/_-]{40,}={0,2}\b/,
]
// The only email allowed is a GitHub noreply address: no personal data in a public repo.
const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g

const url = z.url()
const environment = z.object({
  url,
  worker: z.string().optional(),
  githubEnvironment: z.string().optional(),
})

export const schema = z
  .object({
    name: z.string(),
    brand: z.string(),
    github: z.object({
      organization: z.string(),
      repository: z.string().regex(/^[\w-]+\/[\w.-]+$/),
      board: url,
      account: z.string(),
      commitEmail: z.string().regex(/^\d+\+[\w-]+@users\.noreply\.github\.com$/),
      agentsApp: z.object({ name: z.string(), appId: z.number().int() }),
    }),
    documents: z.record(z.string(), z.string()),
    cloudflare: z.object({ subdomain: z.string() }),
    environments: z.object({ local: environment, stg: environment, prod: environment }).strict(),
    services: z.array(z.object({ name: z.string(), purpose: z.string(), admin: url })),
    secrets: z.array(z.object({ name: z.string(), lives: z.string() })),
  })
  .strict()

export function validate(text) {
  const errors = []
  for (const shape of SECRET_SHAPES)
    if (shape.test(text)) errors.push(`looks like a secret: ${shape}`)
  for (const [email] of text.matchAll(EMAIL))
    if (!email.endsWith('@users.noreply.github.com')) errors.push(`email not allowed: ${email}`)
  const result = schema.safeParse(parse(text))
  if (!result.success)
    errors.push(...result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`))
  return errors
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validate(readFileSync(new URL('../../project.yaml', import.meta.url), 'utf8'))
  if (errors.length) {
    console.error(`project.yaml is invalid:\n- ${errors.join('\n- ')}`)
    process.exit(1)
  }
  console.log('project.yaml ok')
}
