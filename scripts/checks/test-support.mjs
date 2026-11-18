// Fake git/gh runner for the check tests: no network, no repository.
import { createContext } from './context.mjs'

export const EMAIL = ['1+workampo-dev', 'users.noreply.github.com'].join('@')
export const RENOVATE = ['29139614+renovate[bot]', 'users.noreply.github.com'].join('@')

export function failure(status, stderr = '') {
  return () => {
    const error = new Error(`exit ${status}`)
    error.status = status
    error.stderr = stderr
    throw error
  }
}

// routes: [[RegExp over "file arg arg…", output string or function(args, options)], …]
export function fakeRun(routes, calls = []) {
  return (file, args, options) => {
    const line = [file, ...args].join(' ')
    calls.push(line)
    const route = routes.find(([pattern]) => pattern.test(line))
    // Not 1: git grep reads exit 1 as "no match" and would hide a missing route.
    if (!route) return failure(127, `unexpected: ${line}`)()
    return typeof route[1] === 'function' ? route[1](args, options) : route[1]
  }
}

export function logOf(commits) {
  return commits
    .map(
      ({ sha, email = EMAIL, name = 'workampo-dev', reopens = [], files = [] }) =>
        `\x1e${sha}\x1f${email}\x1f${name}\x1f${reopens.join(',')}\n\n${files.join('\n')}\n`,
    )
    .join('')
}

export const issueJson = (state = 'open', labels = ['size:M']) =>
  JSON.stringify({ state, labels, pull: false })

export function context({ routes = [], env = {}, calls } = {}) {
  return createContext({
    env: {
      BASE_SHA: 'base',
      HEAD_SHA: 'head',
      HEAD_REF: 'feature/9-process-automation',
      GH_REPO: 'worKampo/workampo',
      PR_AUTHOR: 'renovate[bot]',
      ...env,
    },
    run: fakeRun(routes, calls),
    commitEmail: EMAIL,
  })
}
