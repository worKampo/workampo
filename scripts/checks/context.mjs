// What the PR checks read, from git and gh through one injectable runner.
import { execFileSync } from 'node:child_process'

const BRANCH = /^(feature|bugfix|hotfix)\/(\d+)-[a-z0-9-]+$/
const RENOVATE_EMAIL = /^\d+\+renovate\[bot\]@users\.noreply\.github\.com$/

export const defaultRun = (file, args, options = {}) =>
  execFileSync(file, args, {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  })

export function branchTicket(ref) {
  const match = ref?.match(BRANCH)
  return match ? Number(match[2]) : null
}

export function parseLog(text) {
  return text
    .split('\x1e')
    .filter((record) => record.trim())
    .map((record) => {
      const [header, ...files] = record.split('\n')
      const [sha, time, email, name] = header.split('\x1f')
      return { sha, time: Number(time), email, name, files: files.filter(Boolean) }
    })
}

export function parseAddedLines(diff) {
  const added = []
  let file = null
  let line = 0
  const lines = diff.split('\n')
  for (const [i, text] of lines.entries()) {
    if (text.startsWith('+++ ') && lines[i - 1]?.startsWith('--- '))
      file = text === '+++ /dev/null' ? null : text.slice('+++ b/'.length)
    else if (text.startsWith('@@')) line = Number(text.match(/\+(\d+)/)[1])
    else if (text.startsWith('+') && file) added.push({ file, line: line++, text: text.slice(1) })
  }
  return added
}

export function isRenovateRun(ref, commits, prAuthor) {
  return (
    prAuthor === 'renovate[bot]' &&
    !!ref?.startsWith('renovate/') &&
    commits.length > 0 &&
    commits.every((c) => c.name === 'renovate[bot]' && RENOVATE_EMAIL.test(c.email))
  )
}

const notFound = (error) => /HTTP 404/.test(`${error.stderr ?? ''}${error.message}`)

export function createContext({ env, run = defaultRun, commitEmail }) {
  const cache = new Map()
  const once = (key, compute) => {
    if (!cache.has(key)) cache.set(key, compute())
    return cache.get(key)
  }
  const git = (args) => run('git', args)
  const gh = (args) => run('gh', args)
  const { BASE_SHA: base, HEAD_SHA: head, HEAD_REF: ref, GH_REPO: repo } = env
  const ticket = branchTicket(ref)

  const ctx = {
    env,
    run,
    git,
    gh,
    ref,
    repo,
    ticket,
    commitEmail,
    labels: (env.PR_LABELS ?? '')
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean),
    commits: () =>
      once('commits', () =>
        parseLog(
          git([
            'log',
            '--reverse',
            '--topo-order',
            '--format=%x1e%H%x1f%ct%x1f%ae%x1f%an',
            '--name-only',
            `${base}..${head}`,
          ]),
        ),
      ),
    changedFiles: () =>
      once('changed', () =>
        git(['diff', '--name-only', `${base}...${head}`])
          .split('\n')
          .filter(Boolean),
      ),
    addedLines: () =>
      once('added', () =>
        parseAddedLines(git(['diff', '-U0', '--no-color', '--no-ext-diff', `${base}...${head}`])),
      ),
    tree: () =>
      once('tree', () => git(['ls-tree', '-r', '--name-only', head]).split('\n').filter(Boolean)),
    // `git grep` exits 1 when nothing matches.
    grep: (pattern, paths) => {
      let out
      try {
        out = git(['grep', '-I', '-n', '-E', pattern, head, '--', ...paths])
      } catch (error) {
        if (error.status === 1) return []
        throw error
      }
      return out
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [file, number, ...text] = line.slice(head.length + 1).split(':')
          return { file, line: Number(number), text: text.join(':') }
        })
    },
    showFile: (path) => {
      try {
        return git(['show', `${head}:${path}`])
      } catch {
        return null
      }
    },
    isRenovate: () => once('renovate', () => isRenovateRun(ref, ctx.commits(), env.PR_AUTHOR)),
    issue: () =>
      once('issue', () => {
        if (!ticket) return null
        try {
          return JSON.parse(
            gh([
              'api',
              `repos/${repo}/issues/${ticket}`,
              '--jq',
              '{state, labels: [.labels[].name], pull: (.pull_request != null)}',
            ]),
          )
        } catch (error) {
          if (notFound(error)) return null
          throw error
        }
      }),
    parent: () =>
      once('parent', () => {
        try {
          return Number(gh(['api', `repos/${repo}/issues/${ticket}/parent`, '--jq', '.number']))
        } catch (error) {
          if (notFound(error)) return null
          throw error
        }
      }),
  }
  return ctx
}
