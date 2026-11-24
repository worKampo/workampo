// Schema SQL comes from packages/db/schema/<kind>.d1.ts, never by hand (ADR-0044, ADR-0077).
//   node scripts/db/migration-new.mjs --global|--shard [--data] <verb_object>
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { branchTicket } from '../checks/context.mjs'
import { main, ROOT } from './d1.mjs'

const DB_DIR = join(ROOT, 'packages', 'db')
const USAGE = 'Usage: pnpm db:migration:new --global|--shard [--data] <verb_object>'
const VERB_OBJECT = /^[a-z]+(_[a-z0-9]+)+$/

export function parseArgs(argv) {
  const kinds = argv.filter((arg) => arg === '--global' || arg === '--shard')
  const isData = argv.includes('--data')
  const names = argv.filter((arg) => !arg.startsWith('--'))
  const known = kinds.length + names.length + (isData ? 1 : 0)

  if (kinds.length !== 1 || names.length !== 1 || known !== argv.length)
    throw new Error(`Expected one database and one name. ${USAGE}`)

  const [name] = names
  if (!VERB_OBJECT.test(name)) throw new Error(`"${name}" is not verb_object. ${USAGE}`)

  return { kind: kinds[0].slice(2), isData, name }
}

export function migrationNew({ kind, isData, name }, io) {
  const ticket = branchTicket(io.branch())
  if (!ticket)
    throw new Error('The branch has no ticket: the migration needs its -- ticket: header')

  const before = new Set(io.listMigrations(kind))
  io.drizzleKit(['generate', `--name=${name}`, ...(isData ? ['--custom'] : [])], kind)
  const created = io.listMigrations(kind).filter((file) => !before.has(file))
  if (created.length !== 1) throw new Error('No migration was generated: the schema has no changes')

  const [file] = created
  io.writeFile(file, `-- ticket: #${ticket}\n${io.readFile(file)}`)

  return file
}

function realIo(kind) {
  const dir = join(DB_DIR, 'migrations', `${kind}.d1`)

  return {
    branch: () =>
      execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim(),
    listMigrations: () => readdirSync(dir).filter((file) => file.endsWith('.sql')),
    drizzleKit: (args) =>
      execFileSync(
        process.execPath,
        [join(DB_DIR, 'node_modules', 'drizzle-kit', 'bin.cjs'), ...args],
        { cwd: DB_DIR, env: { ...process.env, DB_KIND: kind }, stdio: 'inherit' },
      ),
    readFile: (file) => readFileSync(join(dir, file), 'utf8'),
    writeFile: (file, text) => writeFileSync(join(dir, file), text),
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main(() => {
    const args = parseArgs(process.argv.slice(2))
    console.log(`Created ${migrationNew(args, realIo(args.kind))}`)
  })
