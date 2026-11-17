---
status: accepted
date: 2026-11-14
---

# ADR-0014: Buying a domain = changing configuration

## Context

Moving from workers.dev to an own domain must not be a rewrite. Without a domain, Brevo replaces a `@gmail.com` sender with a `@brevosend.com` address: mail arrives, but with a foreign sender and more spam risk.

## Decision

- Moving from workers.dev to an own domain only changes routes, `TENANT_ROUTING` and suffixes. Runbook in `docs/runbooks/`.
- **When to buy it** (2026-11-14): before having real customers. It is the first real expense and one of the triggers to leave "0 € in preliminary stages", together with making the repo private ([ADR-0043](0043-public-repo.md)). Without a domain, Brevo replaces a `@gmail.com` sender with a `@brevosend.com` address: it arrives, but with a foreign sender and more spam risk. It is good for development, staging and first test users.
- **Email by stages**:

| Stage | Email | Cost |
|---|---|---|
| Now, no domain | The project's Gmail; the app sends with Brevo from `@brevosend.com` | 0 € |
| With domain, before customers | Cloudflare Email Routing forwards the domain's addresses to Gmail; Gmail replies with "Send as" (Brevo SMTP); Brevo sends `notifications@` with the authenticated domain | Only the domain |
| With paying customers | Google Workspace Business Starter with one user (about 6.80 €/month with annual commitment or 8.10 € monthly; confirm when contracting); public addresses become aliases or groups, free within the plan; Brevo keeps sending the app's mail | About 7–8 €/month |

- **Domain addresses** (in English, like the default language, [ADR-0047](0047-i18n-from-the-start.md); no catch-all):

| Address | Purpose |
|---|---|
| `notifications@` | Sender of the app's emails, with `Reply-To: support@`. No `no-reply@`: customer replies are useful information |
| `hello@` | General contact (corporate website) |
| `support@` | Help and replies to notifications |
| `billing@` | Billing contact and Stripe account email |
| `privacy@` | Personal data requests ([ADR-0027](0027-legal-and-data-protection.md)) |
| `security@` | Vulnerability reports, in addition to GitHub private reporting ([ADR-0032](0032-security-reviewer.md)) |
| `dmarc@` | DMARC reports |
| `abuse@`, `postmaster@` | The ones standards expect on every domain |

  - All of them arrive at the project's Gmail (or at the Workspace user), separated with filters by recipient and labels; replies are sent by choosing the sender. Future newsletters, on a separate subdomain (`news.`) so as not to affect the reputation of transactional mail.
  - DNS: a single SPF record with Cloudflare and Brevo; Brevo DKIM; DMARC first at `p=none` with reports to `dmarc@` and, when they come out clean, `quarantine`.
  - The addresses are public by design and are declared in `project.yaml` ([ADR-0045](0045-project-profile.md)).
- **The project's accounts stay on the free Gmail** ([bootstrap](../process/bootstrap.md)), above all Cloudflare: it is the emergency key if the domain or the email fail, also with Workspace.
- **Brevo per environment**: a separate free account for staging, with its own key, so as not to spend production's daily quota (about 300 emails per day shared between marketing and transactional; confirm on Brevo's pricing page).

### Defaults

- Backoffice in its own Worker and host ([ADR-0006](0006-same-origin-route-map.md), [ADR-0048](0048-separate-backoffice-worker-and-account-limits.md)); staff authenticated by WorkOS with a role in `DB_GLOBAL`.
- Reserved slugs: `www`, `app`, `api`, `admin`, `bo`, `stg`, `staging`, `prod`, `mail`, `docs`, `legal`, `l`, `t`, `c`…
- Corporate website with static Astro.

## Consequences

- Buying the domain is the first real expense and a trigger to leave "0 € in preliminary stages" ([ADR-0065](0065-zero-spend-and-free-tier-limits.md)).
- Pending confirmations: the Google Workspace price when contracting; Brevo's daily email quota on its pricing page.

## More information

Related: [ADR-0011](0011-environments-without-extra-domain-cost.md), [ADR-0005](0005-dual-resolve-tenant.md).
