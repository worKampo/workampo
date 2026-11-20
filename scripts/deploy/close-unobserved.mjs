// Closes the tickets of a merge whose staging deploy affected no Worker: there is no release to
// observe (ADR-0020, ADR-0060). Usage: close-unobserved.mjs <sha> [<from>]
// gh reads GH_TOKEN from the environment; the token never goes in arguments.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parse } from 'yaml'
import { observationAuthors } from '../observation/check.mjs'
import { messagesLogArgs, parseRefs, postComments } from '../smoke/verification-comment.mjs'
import { moveCard, readComments } from '../work/work.mjs'
import { run, workersChanged } from './deploy.mjs'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const USAGE = 'Usage: node scripts/deploy/close-unobserved.mjs <sha> [<from>]'
const FULL_SHA = /^[0-9a-f]{40}$/
const TEXT = 'Sin Workers afectados: nada que observar'

const marker = (sha) => `<!-- no-workers:${sha} -->`

// Both come from the workflow (`from` from a Worker's /health): only full SHAs reach git.
export function parseArgs(argv) {
  const [sha, from = '', ...rest] = argv
  if (!FULL_SHA.test(sha ?? '') || (from && !FULL_SHA.test(from)) || rest.length)
    throw new Error(USAGE)
  return { sha, from }
}

// Returns the tickets that failed; a failure never closes a ticket.
export async function closeUnobserved({ sha, from }, io) {
  const numbers = parseRefs(io.run('git', messagesLogArgs(sha, from)))
  // Commits can land on master after `sha`: a Worker change of the ticket there is not observed yet.
  const tip = io.masterTip()
  const body = `${TEXT}\n\n${marker(sha)}`
  return postComments(numbers, (number) => {
    const issue = io.issue(number)
    // The issues endpoint also returns pull requests, which are not tickets.
    if (issue.pull_request) return io.log(`#${number}: a pull request, not a ticket.`)
    if (issue.state !== 'open') return io.log(`#${number}: already closed.`)
    // A Worker change of the ticket was released, so its observation window closes it.
    if (io.ticketCommits(number, tip).some((commit) => io.affectsWorker(commit)))
      return io.log(`#${number}: a commit affected a Worker, it waits for its observation window.`)
    const marked = io
      .comments(number)
      .some(
        (c) =>
          (c.body ?? '').includes(marker(sha)) &&
          io.authors.some((a) => a.login === c.user?.login && a.type === c.user?.type),
      )
    if (!marked) io.comment(number, body)
    io.close(number, 'completed')
    io.log(`#${number}: closed, no Worker affected.`)
    io.moveToDone(number, issue.html_url)
  })
}

// Commits up to `tip` naming the ticket; -F narrows, parseRefs decides, so no match is missed.
function ticketCommits(number, tip) {
  const out = run('git', [
    'log',
    '-z',
    '--fixed-strings',
    `--grep=#${number}`,
    '--format=%H%n%B',
    tip,
  ])
  return out
    .split('\0')
    .filter(Boolean)
    .map((record) => record.split('\n'))
    .filter(([, ...message]) => parseRefs(message.join('\n')).includes(number))
    .map(([commit]) => commit)
}

// Same reads as deploy's staleness check: ls-remote (public repo, no credentials), then fetch.
function masterTip() {
  const tip = run('git', ['ls-remote', 'origin', 'refs/heads/master']).split(/\s/)[0]
  if (!FULL_SHA.test(tip)) throw new Error('origin has no master branch')
  run('git', ['fetch', '--no-tags', 'origin', 'master'])
  return tip
}

const gh = (args, input) =>
  execFileSync('gh', args, {
    cwd: ROOT,
    encoding: 'utf8',
    input,
    stdio: [input == null ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  })

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let args
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
  try {
    const config = parse(readFileSync(join(ROOT, 'project.yaml'), 'utf8'))
    const { repository } = config.github
    const ghIo = {
      run: (_, args) => gh(args),
      log: console.log,
      warn: console.error,
      env: process.env,
    }
    // git log stops at a shallow boundary without failing: an earlier Worker commit would be missed.
    if (run('git', ['rev-parse', '--is-shallow-repository']).trim() === 'true')
      throw new Error('The checkout is shallow: check out the full history (fetch-depth: 0).')
    const failed = await closeUnobserved(args, {
      run,
      authors: observationAuthors(config),
      issue: (number) => JSON.parse(gh(['api', `repos/${repository}/issues/${number}`])),
      comments: (number) => readComments(ghIo, repository, number),
      masterTip,
      ticketCommits,
      affectsWorker: (commit) => workersChanged(`${commit}^1`, commit, { run }).length > 0,
      comment: (number, body) =>
        gh(['issue', 'comment', String(number), '--repo', repository, '--body-file', '-'], body),
      close: (number, reason) =>
        gh(['issue', 'close', String(number), '--repo', repository, '--reason', reason]),
      // moveCard only warns: github.token may lack the Projects permission, and the ticket is closed.
      moveToDone: (_, url) => moveCard(url, 'Done', { dryRun: false }, config, ghIo),
      log: console.log,
      warn: console.error,
    })
    if (failed.length) {
      console.error(`Failed on ${failed.map((n) => `#${n}`).join(', ')}.`)
      process.exit(1)
    }
  } catch (error) {
    console.error(error.stderr?.toString().trim() || error.message)
    process.exit(1)
  }
}
