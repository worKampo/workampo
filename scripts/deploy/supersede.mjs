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
  // Only the pushes to master that this workflow deploys; 100 is far above any real backlog.
  const waiting = JSON.parse(
    gh([
      'run',
      'list',
      '--workflow',
      'deploy.yml',
      '--branch',
      'master',
      '--event',
      'push',
      '--status',
      'waiting',
      '--limit',
      '100',
      '--json',
      'databaseId',
    ]),
  )
  const failed = []
  for (const id of runsToCancel({ waiting, currentId })) {
    try {
      // Asked again right before: an old run approved meanwhile is deploying, never cancel it.
      const { status } = JSON.parse(gh(['run', 'view', String(id), '--json', 'status']))
      if (status !== 'waiting') {
        console.log(`Run ${id} is ${status} now; left alone`)
        continue
      }
      gh(['run', 'cancel', String(id)])
      console.log(`Cancelled waiting run ${id}`)
    } catch (error) {
      // One run that cannot be cancelled must not keep the others waiting.
      failed.push(id)
      console.error(`Could not cancel run ${id}: ${error.message}`)
    }
  }
  if (failed.length) process.exit(1)
}
