// Pins core.hooksPath to this repo's own hooks dir, so lefthook never installs into the machine's
// global one. Absolute and from the common dir, because in a worktree `.git` is a file.
import { execFileSync } from 'node:child_process'

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
const common = git('rev-parse', '--path-format=absolute', '--git-common-dir')
git('config', 'core.hooksPath', `${common}/hooks`)
