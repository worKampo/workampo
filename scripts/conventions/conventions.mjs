// The code conventions that are not imports, checked over every tracked file (issue 111).
//   node scripts/conventions/conventions.mjs
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  databaseBindingErrors,
  providerHostErrors,
  rawEnvErrors,
  routerErrors,
} from './api-rules.mjs'
import { exportPatternErrors, reexportErrors } from './package-rules.mjs'
import { folderSizeErrors, srcLayoutErrors } from './structure-rules.mjs'
import { arbitraryValueErrors, handwrittenTextErrors, pageClassErrors } from './web-rules.mjs'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))

const PER_FILE = [
  routerErrors,
  rawEnvErrors,
  databaseBindingErrors,
  providerHostErrors,
  handwrittenTextErrors,
  arbitraryValueErrors,
  pageClassErrors,
  exportPatternErrors,
  reexportErrors,
]

export function conventionErrors({ files, read, domains }) {
  const scanned = files.filter((path) => /\.(ts|tsx|mjs|css)$|\/package\.json$/.test(path))

  return [
    ...srcLayoutErrors({ files, domains }),
    ...folderSizeErrors(files),
    ...scanned.flatMap((path) => {
      const text = read(path)

      return PER_FILE.flatMap((rule) => rule({ path, text }))
    }),
  ]
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
    .split('\n')
    // ls-files -c still lists a tracked file deleted in the working tree.
    .filter((path) => path && existsSync(`${ROOT}${path}`))
  // The domains are the living specs' files (docs/domains/<domain>.md).
  const domains = readdirSync(new URL('../../docs/domains', import.meta.url))
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .map((name) => name.replace(/\.md$/, ''))
  const errors = conventionErrors({
    files,
    read: (path) => readFileSync(`${ROOT}${path}`, 'utf8'),
    domains,
  })

  for (const error of errors) console.error(error)
  if (errors.length) process.exit(1)
  console.log('conventions ok')
}
