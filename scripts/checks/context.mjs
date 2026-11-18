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
      const [sha, email, name, reopens = '', parents = ''] = header.split('\x1f')
      const ids = reopens.split(',').map((id) => id.trim())
      const isMerge = parents.trim().split(/\s+/).length > 1
      return {
        sha,
        email,
        name,
        reopens: ids.filter(Boolean),
        isMerge,
        files: files.filter(Boolean),
      }
    })
}

// `git diff --name-status -z`: deletions keep the old path, renames and copies give both.
export function parseNameStatus(text) {
  const tokens = text.split('\0')
  const entries = []
  for (let i = 0; i < tokens.length && tokens[i]; ) {
    const status = tokens[i][0]
    const paths = 'RC'.includes(status) ? tokens.slice(i + 1, i + 3) : [tokens[i + 1]]
    entries.push({ status, paths })
    i += 1 + paths.length
  }
  return entries
}

// Headers only count outside hunks; inside one, the counts of `@@ -a,b +c,d @@` say how many
// lines are content, so an added line that looks like `+++ b/x` cannot switch the file.
export function parseAddedLines(diff, file) {
  const added = []
  let line = 0
  let oldLeft = 0
  let newLeft = 0
  for (const text of diff.split('\n')) {
    if (oldLeft > 0 || newLeft > 0) {
      if (text.startsWith('+')) {
        added.push({ file, line: line++, text: text.slice(1) })
        newLeft--
      } else if (text.startsWith('-')) oldLeft--
      else if (text.startsWith(' ')) {
        line++
        oldLeft--
        newLeft--
      } else if (!text.startsWith('\\')) throw new Error(`${file}: malformed hunk line: ${text}`)
      continue
    }
    const hunk = text.match(/^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/)
    if (!hunk) continue
    oldLeft = Number(hunk[1] ?? 1)
    line = Number(hunk[2])
    newLeft = Number(hunk[3] ?? 1)
  }
  if (oldLeft > 0 || newLeft > 0) throw new Error(`${file}: truncated hunk`)
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
    // A merge lists what differs from every parent: what its resolution introduced, and a file
    // both sides changed even when git combined it cleanly; never what only one side brought.
    commits: () =>
      once('commits', () =>
        parseLog(
          git([
            'log',
            '--reverse',
            '--topo-order',
            '--diff-merges=combined',
            '--format=%x1e%H%x1f%ae%x1f%an%x1f%(trailers:key=Reopen,valueonly,unfold,separator=%x2c)%x1f%P',
            '--name-only',
            `${base}..${head}`,
          ]),
        ),
      ),
    nameStatus: () =>
      once('nameStatus', () =>
        parseNameStatus(git(['diff', '--name-status', '-z', `${base}...${head}`])),
      ),
    changedFiles: () => [...new Set(ctx.nameStatus().flatMap((entry) => entry.paths))],
    // One diff per file, named from the -z listing, so the patch text never decides the file.
    addedLines: () =>
      once('added', () =>
        ctx
          .nameStatus()
          .filter((entry) => entry.status !== 'D')
          .flatMap(({ paths }) =>
            parseAddedLines(
              git([
                'diff',
                '-U0',
                '--no-color',
                '--no-ext-diff',
                `${base}...${head}`,
                '--',
                ...paths.map((path) => `:(literal)${path}`),
              ]),
              paths.at(-1),
            ),
          ),
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
