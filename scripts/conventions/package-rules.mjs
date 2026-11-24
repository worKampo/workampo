// What a package publishes (code conventions, "Names"): named entries only, and no barrels.

// The entry of each packages/ui family and the API's contract are the only files that re-export.
const REEXPORTERS = [/^packages\/ui\/src\/([^/]+)\/\1\.ts$/, /^apps\/api\/src\/contract\.ts$/]

export function exportPatternErrors({ path, text }) {
  if (!/^(apps|packages)\/[^/]+\/package\.json$/.test(path)) return []
  const exports = JSON.parse(text).exports ?? {}
  const keys = typeof exports === 'string' ? ['.'] : Object.keys(exports)

  return keys
    .filter((key) => key.includes('*'))
    .map((key) => `${path}: exports "${key}" is a pattern; name each entry other packages use`)
}

export function reexportErrors({ path, text }) {
  if (
    !/^(apps|packages)\/[^/]+\/src\/.+\.tsx?$/.test(path) ||
    REEXPORTERS.some((r) => r.test(path))
  )
    return []

  return /^export (type )?(\*( as \w+)?|\{[^}]*\}) from /m.test(text)
    ? [`${path}: re-exports; import from the file that defines it`]
    : []
}
