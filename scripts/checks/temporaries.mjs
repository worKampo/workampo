// No `.work/` file and no `@wip(` in the living specs of what reaches master (ADR-0052).
export const name = 'Temporaries'

const isSpec = (file) => file.startsWith('docs/domains/') && file !== 'docs/domains/README.md'

export function temporaryErrors(tree, wipHits) {
  return [
    ...tree.filter((file) => file.startsWith('.work/')).map((file) => `${file} must be deleted`),
    ...wipHits
      .filter((hit) => isSpec(hit.file))
      .map((hit) => `${hit.file}:${hit.line}: @wip must become @issue`),
  ]
}

export function check(ctx) {
  return { errors: temporaryErrors(ctx.tree(), ctx.grep('@wip[(]', ['docs/domains'])) }
}
