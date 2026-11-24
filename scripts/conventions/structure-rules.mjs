// Layout of code folders (docs/process/code-conventions.md, "Layout of a domain").
import { posix } from 'node:path'

const MAX_CODE_FILES = 8
// shortcut: scripts/checks/ predates the rule, until issue 113 orders scripts/.
const TOO_BIG_UNTIL_LATER = { 'scripts/checks': 'issue 113' }
// Files at the root of src/ that gather every domain, since _shared/ may not import domains.
const GATHERERS = ['route-tree.ts', 'index.ts', 'contract.ts', 'errors.ts', 'main.tsx']
// Packages whose src/ has its own written exception: families plus styles/, and a one-purpose package.
const OWN_LAYOUT = ['packages/ui', 'packages/i18n']

export const isCode = (path) =>
  /\.(ts|tsx|mjs)$/.test(path) &&
  !/\.(test|int\.test|e2e|contract)\.tsx?$|\.test\.mjs$|\.d\.ts$/.test(path)

const isTest = (path) => /\.(test|int\.test)\.(ts|tsx|mjs)$/.test(path)

// Inside src/ only _shared/, one folder per domain and the files that gather every domain.
export function srcLayoutErrors({ files, domains }) {
  return files
    .map((path) => path.match(/^((?:apps|packages)\/[^/]+)\/src\/([^/]+)(\/)?/))
    .filter((m) => m && !OWN_LAYOUT.includes(m[1]))
    .filter(([path, , first, isFolder]) => {
      if (isFolder) return first !== '_shared' && !domains.includes(first)
      const base = first.replace(/\.(test|int\.test)\.(ts|tsx)$/, '.$2').replace(/\.tsx?$/, '')

      return (
        !GATHERERS.some((g) => g.replace(/\.tsx?$/, '') === base) || !(isCode(path) || isTest(path))
      )
    })
    .map(
      ([path, pkg, first]) =>
        `${path}: ${pkg}/src/ holds only _shared/, a domain folder or a file gathering every domain, not "${first}"`,
    )
}

export function folderSizeErrors(files) {
  const counts = new Map()
  for (const path of files.filter(isCode)) {
    const dir = posix.dirname(path)
    counts.set(dir, (counts.get(dir) ?? 0) + 1)
  }

  return [...counts]
    .filter(([dir, count]) => count > MAX_CODE_FILES && !TOO_BIG_UNTIL_LATER[dir])
    .map(
      ([dir, count]) =>
        `${dir}/: ${count} code files, more than ${MAX_CODE_FILES}; split it into subfolders by feature or use case`,
    )
}
