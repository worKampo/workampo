// Posts the verification comment on the ticket issues of the deployed commits.
// Usage: verification-comment.mjs <stg|prod> <url> <sha> [<from-sha>]
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const TITLES = { stg: 'Staging verification', prod: 'Release verification' }
const USAGE = 'Usage: verification-comment.mjs <stg|prod> <url> <sha> [<from-sha>]'

export function parseRefs(message) {
  const refs = [...message.matchAll(/^Refs:[ \t]*#(\d+)[ \t]*$/gim)].map((match) =>
    Number(match[1]),
  )
  return [...new Set(refs)]
}

export function parsePrNumber(subject) {
  const match = subject.match(/\(#(\d+)\)\s*$/)
  return match ? Number(match[1]) : null
}

export function messagesLogArgs(sha, from) {
  return from ? ['log', `${from}..${sha}`, '--format=%B'] : ['log', '-1', '--format=%B', sha]
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

// Returns the issues whose comment failed, so one failure does not skip the rest.
export function postComments(issues, post) {
  const failed = []
  for (const issue of issues) {
    try {
      post(issue)
    } catch (error) {
      console.error(`Could not comment on #${issue}: ${error.message}`)
      failed.push(issue)
    }
  }
  return failed
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [env, url, sha, from] = process.argv.slice(2)
  if (!TITLES[env] || !url || !sha) {
    console.error(USAGE)
    process.exit(1)
  }
  const git = (args) => execFileSync('git', args, { encoding: 'utf8' })
  const issues = parseRefs(git(messagesLogArgs(sha, from)))
  if (issues.length === 0) {
    console.log(`No Refs trailer in ${from ? `${from}..${sha}` : sha}: nothing to comment on.`)
    process.exit(0)
  }
  const body = buildComment({
    env,
    url,
    sha,
    deployedAt: new Date().toISOString(),
    smokeResult: 'passed',
    prNumber: parsePrNumber(git(['log', '-1', '--format=%s', sha]).trim()),
  })
  const failed = postComments(issues, (issue) => {
    execFileSync('gh', ['issue', 'comment', String(issue), '--body-file', '-'], {
      input: body,
      stdio: ['pipe', 'inherit', 'inherit'],
    })
    console.log(`Commented on #${issue}.`)
  })
  if (failed.length) console.error(`Comments failed on ${failed.map((n) => `#${n}`).join(', ')}.`)
}
