// Prints a one-hour installation token of the agents' GitHub App (D41, D64), scoped to this repo:
//   GH_TOKEN=$(node scripts/github/app-token.mjs) gh pr create ...
// The private key never leaves %USERPROFILE%\.workampo\; this script is the only reader.
import { createSign } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const APP_ID = 5780402 // workampo-agents; public, not a secret
const OWNER = 'worKampo'
const REPO = 'workampo'
const KEY_PATH = join(homedir(), '.workampo', 'github-app.pem')

const base64url = (value) => Buffer.from(value).toString('base64url')
const now = Math.floor(Date.now() / 1000)
// iat is backdated to absorb clock drift; GitHub rejects exp more than 10 minutes ahead.
const unsigned = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64url(
  JSON.stringify({ iat: now - 60, exp: now + 540, iss: APP_ID }),
)}`
const signature = createSign('RSA-SHA256')
  .update(unsigned)
  .sign(readFileSync(KEY_PATH), 'base64url')
const jwt = `${unsigned}.${signature}`

async function github(path, init = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${jwt}`,
      'x-github-api-version': '2022-11-28',
    },
  })
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path}: ${response.status}`)
  return response.json()
}

const installation = await github(`/repos/${OWNER}/${REPO}/installation`)
const { token } = await github(`/app/installations/${installation.id}/access_tokens`, {
  method: 'POST',
  body: JSON.stringify({ repositories: [REPO] }),
})
process.stdout.write(token)
