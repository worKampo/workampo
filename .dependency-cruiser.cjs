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
    {
      name: 'identity-provider-seam',
      comment: 'Only _shared/auth/ picks and uses an identity provider implementation (ADR-0071).',
      severity: 'error',
      from: { pathNot: '^apps/api/src/_shared/auth/' },
      to: { path: '^apps/api/src/_shared/auth/(workos|fake)-' },
    },
    {
      name: 'database-seam',
      comment: 'Only repos and _shared/db/ touch Drizzle or the database client (ADR-0053).',
      severity: 'error',
      from: {
        path: '^apps/[^/]+/src/',
        pathNot: ['-repo\\.ts$', '^apps/[^/]+/src/_shared/db/'],
      },
      to: { path: ['(^|node_modules/)drizzle-orm(/|$)', '^apps/[^/]+/src/_shared/db/'] },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // node_modules stays visible (doNotFollow only), or the package rules would never match.
    exclude: { path: '(^|/)(\\.wrangler|dist)/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'default'] },
  },
}
