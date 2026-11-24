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
      // Nor the router: a page hook gets navigation as a callback, so the mobile app can reuse it.
      to: {
        path: [
          '(^|node_modules/)react-dom(/|$)',
          '(^|node_modules/)@tanstack/react-router(/|$)',
          '^apps/web/',
        ],
      },
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
      from: { path: '^(apps|packages)/[^/]+/src/_shared/' },
      // packages/ui's folders are component families, not domains.
      to: { path: '^(apps|packages)/[^/]+/src/[^_][^/]*/', pathNot: '^packages/ui/' },
    },
    {
      name: 'no-domain-internals',
      comment: 'A domain only uses the top-level files of another domain (D53).',
      severity: 'error',
      from: { path: '^(apps|packages)/([^/]+)/src/([^_/][^/]*)/' },
      to: { path: '^$1/$2/src/[^_/][^/]*/.+/', pathNot: '^$1/$2/src/$3/' },
    },
    {
      name: 'identity-provider-seam',
      comment:
        'Only _shared/identity/ picks and uses an identity provider implementation (ADR-0071).',
      severity: 'error',
      // Tests and their helpers may use the fake's fixed fixtures.
      from: {
        pathNot: [
          '^apps/api/src/_shared/identity/',
          '^apps/api/src/_shared/testing/',
          '\\.test\\.tsx?$',
        ],
      },
      to: { path: '^apps/api/src/_shared/identity/(workos|fake)-' },
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
      name: 'pages-only-from-their-route',
      comment:
        'A page is imported only, lazily, by its own feature route file: anything else would pull it into its chunk (code conventions).',
      severity: 'error',
      from: { path: '^apps/web/src/', pathNot: ['\\.route\\.ts$', '\\.test\\.tsx?$'] },
      to: { path: '\\.page\\.tsx$', dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'pages-loaded-lazily',
      comment: 'Even its own route file imports a page only with import() (ADR-0073 point 4).',
      severity: 'error',
      from: { path: '^apps/web/src/', pathNot: '\\.test\\.tsx?$' },
      to: { path: '\\.page\\.tsx$', dynamic: false, dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'pages-only-from-their-own-route',
      severity: 'error',
      from: { path: '^(apps/web/src/.+)/[^/]+\\.route\\.ts$' },
      to: {
        path: '\\.page\\.tsx$',
        pathNot: ['^$1/[^/]+\\.page\\.tsx$', '^$1/[^/]+/[^/]+\\.page\\.tsx$'],
      },
    },
    {
      name: 'page-pieces-stay-in-their-page',
      comment:
        "A component inside a page's folder belongs to that page; shared ones move up a level (the person, 2026-11-24).",
      severity: 'error',
      from: { path: '^(.+)/[^/]+$', pathNot: '\\.test\\.tsx?$' },
      to: {
        path: '^apps/web/src/[^_/][^/]*/[^/]+/[^/]+/[^/.]+\\.tsx$',
        pathNot: '^$1/',
      },
    },
    {
      name: 'apps-call-the-api-through-app-core',
      comment:
        'Pages and their pieces use hooks; only app-core talks to the API (the person, 2026-11-24).',
      severity: 'error',
      from: { path: '^apps/web/src/' },
      to: { path: '(^|node_modules/)hono(/|$)' },
    },
    {
      name: 'only-api-files-use-the-client',
      comment:
        "In app-core only the .api.ts files and the client's own module use hc (the person, 2026-11-24).",
      severity: 'error',
      from: {
        path: '^packages/app-core/src/',
        pathNot: ['\\.api\\.ts$', '/_shared/api-client\\.ts$', '/_shared/testing/'],
      },
      to: { path: '(^|node_modules/)hono/(dist/)?client' },
    },
    {
      name: 'provider-in-the-name',
      comment:
        'A file that uses a provider says so in its name, even when it is the only one (the person, 2026-11-24).',
      severity: 'error',
      from: { path: '^(apps|packages)/', pathNot: ['(^|/|\\.)d1[-.]', '\\.test\\.ts$'] },
      to: { path: ['^apps/[^/]+/src/_shared/db/d1-', '(^|node_modules/)drizzle-orm/d1(/|$)'] },
    },
    {
      name: 'database-seam',
      comment: 'Only repos and _shared/db/ touch Drizzle or the database client (ADR-0053).',
      severity: 'error',
      from: {
        path: '^apps/[^/]+/src/',
        pathNot: ['\\.repo\\.ts$', '^apps/[^/]+/src/_shared/db/'],
      },
      to: { path: ['(^|node_modules/)drizzle-orm(/|$)', '^apps/[^/]+/src/_shared/db/'] },
    },
    {
      name: 'route-calls-logic-only',
      comment:
        "An endpoint's entry validates, calls its logic and answers; data belongs to the logic (the person, 2026-11-24).",
      severity: 'error',
      from: { path: '\\.route\\.ts$' },
      to: { path: '\\.repo\\.ts$' },
    },
    {
      name: 'logic-without-http',
      comment:
        'Logic knows no Hono: the entry turns the request into arguments (the person, 2026-11-24).',
      severity: 'error',
      from: { path: '\\.logic\\.ts$' },
      to: { path: '(^|node_modules/)hono(/|$)' },
    },
    {
      name: 'no-tests-in-production',
      comment:
        'Production code never imports a test, an e2e scenario or a contract suite (ADR-0029).',
      severity: 'error',
      from: { pathNot: ['\\.(test|e2e|contract)\\.tsx?$', '/_shared/testing/', '/e2e/', '/test/'] },
      to: { path: '\\.(test|e2e|contract)\\.tsx?$' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // node_modules stays visible (doNotFollow only), or the package rules would never match.
    // Only our own build output: a package's dist/ (hono's) must stay visible to the rules.
    exclude: { path: '(^|/)\\.wrangler/|^(apps|packages)/[^/]+/dist/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'default'] },
  },
}
