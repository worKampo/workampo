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
      comment: 'packages/app-core may import the API route type for hc, as a type only (ADR-0073).',
      from: { path: '^packages/' },
      to: { path: '^apps/', dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'packages-not-from-apps-even-as-types',
      severity: 'error',
      from: { path: '^packages/', pathNot: '^packages/app-core/' },
      to: { path: '^apps/' },
    },
    {
      name: 'app-core-has-no-dom',
      comment:
        'packages/app-core is shared with the mobile app: no react-dom, nothing of apps/web (ADR-0057).',
      severity: 'error',
      from: { path: '^packages/app-core/', pathNot: '\\.test\\.ts$' },
      to: { path: ['(^|node_modules/)react-dom(/|$)', '^apps/web/'] },
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
      // Tests and their helpers may use the fake's fixed fixtures.
      from: {
        pathNot: [
          '^apps/api/src/_shared/auth/',
          '^apps/api/src/_shared/testing/',
          '\\.test\\.tsx?$',
        ],
      },
      to: { path: '^apps/api/src/_shared/auth/(workos|fake)-' },
    },
    {
      name: 'error-tracking-seam',
      comment:
        'Only the sentry-* files of _shared/error-tracking/ import a Sentry package (ADR-0053).',
      severity: 'error',
      from: { pathNot: '^apps/[^/]+/src/_shared/error-tracking/sentry-[^/]+\\.ts$' },
      to: { path: '(^|node_modules/)@sentry/' },
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
