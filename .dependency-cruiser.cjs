/** Architecture rules from D53 and D57. */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'packages-not-from-apps',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^apps/' },
    },
    {
      name: 'domain-is-pure',
      comment: 'packages/domain has no I/O and no frameworks (D57).',
      severity: 'error',
      from: { path: '^packages/domain/' },
      to: {
        // Unresolved specifiers keep their bare name, so match both forms.
        path: ['^apps/', '(^|node_modules/)(hono|drizzle-orm|react|react-dom)(/|$)'],
        dependencyTypesNot: ['type-only'],
      },
    },
    {
      name: 'shared-not-from-domains',
      comment: 'Everything in src/ is a domain except _shared/, which imports no domain (D53).',
      severity: 'error',
      from: { path: '^apps/[^/]+/src/_shared/' },
      to: { path: '^apps/[^/]+/src/[^_][^/]*/' },
    },
    {
      name: 'no-domain-internals',
      comment: 'A domain only uses the top-level files of another domain (D53).',
      severity: 'error',
      from: { path: '^apps/([^/]+)/src/([^_/][^/]*)/' },
      to: { path: '^apps/$1/src/[^_/][^/]*/.+/', pathNot: '^apps/$1/src/$2/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(node_modules|\\.wrangler|dist)/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'default'] },
  },
}
