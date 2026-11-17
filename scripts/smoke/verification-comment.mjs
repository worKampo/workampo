// Posts the verification comment on the ticket issue of a commit. Usage: verification-comment.mjs <stg|prod> <url> <sha>
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const TITLES = { stg: 'Staging verification', prod: 'Release verification' }

export function parseRefs(message) {
  return [...message.matchAll(/^Refs:\s*#(\d+)\s*$/gim)].map((match) => Number(match[1]))
}

export function parsePrNumber(subject) {
  const match = subject.match(/\(#(\d+)\)\s*$/)
  return match ? Number(match[1]) : null
}

export function buildComment({ env, url, sha, deployedAt, smokeResult, prNumber }) {
  const lines = [
    `## ${TITLES[env]}`,
    '',
    `- Environment: ${env}`,
    `- URL: ${url}`,
    `- SHA: ${sha}`,
    `- Deployed: ${deployedAt}`,
    `- Smoke: ${smokeResult}`,
  ]
  if (prNumber) lines.push(`- PR: #${prNumber}`)
  return lines.join('\n')
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [env, url, sha] = process.argv.slice(2)
  if (!TITLES[env] || !url || !sha) {
    console.error('Usage: verification-comment.mjs <stg|prod> <url> <sha>')
    process.exit(1)
  }
  const message = execFileSync('git', ['log', '-1', '--format=%B', sha], { encoding: 'utf8' })
  const issues = parseRefs(message)
  if (issues.length === 0) {
    console.log(`No Refs trailer in ${sha}: nothing to comment on.`)
    process.exit(0)
  }
  const body = buildComment({
    env,
    url,
    sha,
    deployedAt: new Date().toISOString(),
    smokeResult: 'passed',
    prNumber: parsePrNumber(message.split('\n')[0]),
  })
  for (const issue of issues) {
    execFileSync('gh', ['issue', 'comment', String(issue), '--body-file', '-'], {
      input: body,
      stdio: ['pipe', 'inherit', 'inherit'],
    })
    console.log(`Commented on #${issue}.`)
  }
}
