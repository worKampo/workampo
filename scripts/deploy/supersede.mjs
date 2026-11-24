// Cancels the older runs of deploy.yml still waiting for the prod approval: the newest carries
// their commits, so only it needs approving (issue 158). Other workflows sharing the deploy-prod
// group (deploy-all, backfill) are never touched.
//   node scripts/deploy/supersede.mjs   (in Actions: GITHUB_RUN_ID, GH_TOKEN with actions: write)
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Run ids grow with time, so an older run has a smaller id.
export function runsToCancel({ waiting, currentId }) {
  return waiting.filter((run) => run.databaseId < currentId).map((run) => run.databaseId)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const currentId = Number(process.env.GITHUB_RUN_ID)
  if (!currentId) throw new Error('GITHUB_RUN_ID is not set: run this from Actions')

  const gh = (args) => execFileSync('gh', args, { encoding: 'utf8' })
  const waiting = JSON.parse(
    gh(['run', 'list', '--workflow', 'deploy.yml', '--status', 'waiting', '--json', 'databaseId']),
  )
  const ids = runsToCancel({ waiting, currentId })

  for (const id of ids) gh(['run', 'cancel', String(id)])
  console.log(ids.length ? `Cancelled waiting runs: ${ids.join(', ')}` : 'No older run waiting.')
}
