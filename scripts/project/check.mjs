// Validates project.yaml (ADR-0045). Run by `pnpm check`.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { z } from 'zod'
import { findNoEntra } from '../lib/no-entra.mjs'

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
  const data = parse(text)
  // Scan the decoded values too: YAML escapes such as g hide a token from the raw text.
  const errors = [...new Set([...findNoEntra(text), ...findNoEntra(JSON.stringify(data))])]
  const result = schema.safeParse(data)
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
