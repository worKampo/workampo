// Fails when AGENTS.md or an agent adapter names a path that does not exist (ADR-0015).
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const REPO_DIRS = /^(apps|packages|scripts|docs|\.github|\.claude|\.cursor)\//
const FILE_EXT = /\.(md|mdc|mjs|ts|tsx|json|jsonc|yaml|yml|cjs)$/

// A git-ignored file exists only on this machine, so CI would not find it.
function inRepo(path) {
  if (!existsSync(path)) return false
  try {
    execFileSync('git', ['check-ignore', '-q', path], { cwd: ROOT, stdio: 'ignore' })
    return false
  } catch {
    return true
  }
}

// .work/ holds the branch temporaries: it exists only while a ticket is in progress, never on master.
const isTemporary = (path) => /^(\.\/)?\.work\//.test(path)

export function missingPaths(text, fileDir, root = ROOT) {
  const missing = []
  for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const path = target.split('#')[0]
    if (!path || /^[a-z]+:/.test(path) || isTemporary(path)) continue
    if (!inRepo(join(fileDir, path))) missing.push(path)
  }
  for (const [, code] of text.matchAll(/`([^`\s]+)`/g)) {
    // Globs, placeholders, home paths and package names are not repo paths.
    if (/[*<>$~@]/.test(code) || !code.includes('/') || isTemporary(code)) continue
    if (!REPO_DIRS.test(code) && !FILE_EXT.test(code)) continue
    if (!inRepo(join(root, code))) missing.push(code)
  }
  return missing
}

function agentFiles() {
  const dir = (d, ext) =>
    existsSync(join(ROOT, d))
      ? readdirSync(join(ROOT, d))
          .filter((f) => f.endsWith(ext))
          .map((f) => join(d, f))
      : []
  return [
    'AGENTS.md',
    'CLAUDE.md',
    'GEMINI.md',
    '.github/copilot-instructions.md',
    ...dir('.cursor/rules', '.mdc'),
    ...dir('.claude/agents', '.md'),
  ].filter((f) => existsSync(join(ROOT, f)))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = agentFiles().flatMap((file) =>
    missingPaths(readFileSync(join(ROOT, file), 'utf8'), dirname(join(ROOT, file))).map(
      (p) => `${relative(ROOT, join(ROOT, file))}: ${p}`,
    ),
  )
  if (problems.length) {
    console.error(`Agent context names paths that do not exist:\n- ${problems.join('\n- ')}`)
    process.exit(1)
  }
  console.log('agent context paths ok')
}
