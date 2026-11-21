---
status: accepted
date: 2026-11-21
related: [8, 14, 27, 29, 53, 63, 65]
---

# ADR-0071: Own login, EU email behind an outbox, and a domain before real recipients

## Context

The person decided on strict EU data residency on 2026-11-21: user data, its processing, the subprocessors and support access stay in the EU. Three spikes checked the providers this repo relied on:

- **WorkOS** (identity, [ADR-0008](0008-own-session-in-d1-host-only-cookie.md)) has no EU region; data is processed in the US (issue 23).
- **No managed identity provider** meets "EU only", "free" and "sends the sign-in emails with our brand in Spanish and English" at once: Clerk, Kinde, Zitadel, Ory and Logto send data or email outside the EU, or charge for it; Hanko is EU-only but has no Spanish or branding on its free plan (issue 65).
- **Brevo** (email, [ADR-0063](0063-eu-data-residency.md), [ADR-0014](0014-buying-a-domain-is-a-config-change.md)) has subprocessors in the US and India and brands free emails. **No EU email service sends from `*.workers.dev`**: every one needs our own domain with SPF, DKIM and DMARC (issue 66). AhaSend (Netherlands; servers in Germany and Finland; 1,000 emails a month free, no card, hosted templates) and Lettermint (Netherlands; EU-only subprocessors; 300 a month free, no card) meet the rule.

Until there is a domain, only the person tests the product.

## Decision

Decided by the person in issue 65 (2026-11-21).

1. **Own login, no identity provider.** The session stays as ADR-0008 sets it (random id in `DB_GLOBAL`, `__Host-` cookie), following Lucia's session pattern (a small file in our code, not a library). Two ways in:
   - **One-time code by email**: random, stored only as a hash, single use, short expiry; attempts limited per email and per IP; the same answer whether the account exists or not; the session rotates on sign-in; a sign-in link, if added, opens a confirmation page before it is redeemed (mail scanners open links).
   - **"Continue with Google"** through OpenID Connect with `oauth4webapi` (certified client), with `state`, `nonce` and PKCE, and only the `openid email profile` scopes.
   It is a critical zone: the tickets that build it are `size:L`.
2. **Every provider behind an interface, our own login included** (the person, 2026-11-21), so that changing provider is a new adapter and one line of configuration ([ADR-0053](0053-code-conventions.md)):
   - `_shared/auth/` defines an identity interface: start a sign-in, complete it, and return a verified identity (provider, subject, email, name). **Our own login (email code and Google) is one implementation of it**, as WorkOS, Logto or any other could be later. The session (ADR-0008), users, companies and roles stay outside every provider.
   - `_shared/email/` defines a sender interface that receives an already rendered message. The templates (subject and body per language) are rendered outside the sender, so changing provider never touches them.
   - Which implementation runs is chosen per environment in one place. No code outside `_shared/auth/` and `_shared/email/` imports a provider; dependency-cruiser enforces it, as ADR-0053 already does for provider packages.
   - One contract test suite per interface runs against every implementation, the fakes included.
3. **Email**: templates in our code (React Email or jsx-email), in Spanish and English, and sender implementations:
   - **Outbox** in local and staging: it does not send; it stores each email in that environment's database, and a staging-only page `/__dev/outbox` shows them, codes and links included. It never exists in production, like `/__debug/error`, and the production build fails if it includes it. Staging holds test data only.
   - **AhaSend** in production, with **Lettermint** as fallback; the switch is a change of adapter.
4. **A domain before real recipients.** Buying the domain (about 10 € a year, ADR-0014) is the only cost of this decision and the person's explicit spend. Until then the product can be built and tested end to end by the person: Google sign-in works in Google's testing mode on `*.workers.dev`, and every email lands in the outbox. Emails to other people (invitations, sign-ups) wait for the domain; then AhaSend is configured with SPF, DKIM and DMARC and Google brand verification is requested.

This supersedes:

- In ADR-0008, WorkOS as the identity provider: the identity check is ours.
- In ADR-0063, the WorkOS and Brevo rows: Google (only for whoever chooses it) and the email service replace them.
- In ADR-0014, Brevo as the sending service in the "Email by stages" table: no sending before the domain (outbox), AhaSend after it. Receiving mail on the domain stays as ADR-0014 says.
- Wherever another ADR names WorkOS as the identity provider or Brevo as the sender (for example ADR-0029's fake login, which stays, with our own adapter), read this ADR.

## Consequences

- No user data leaves the EU for sign-in; zero monthly spend; no lock-in: moving to a managed provider later (for example if one offers an EU region) is a new implementation of the identity interface, and users keep their accounts because the session and the user records are ours.
- We own the security of the sign-in flows: they get a threat model and the security reviewer ([ADR-0032](0032-security-reviewer.md)) on every change.
- PRD 10 is unblocked. Its estimate grows: the spike puts the sign-in core at 6 to 9 days.
- The privacy policy ([ADR-0027](0027-legal-and-data-protection.md)) lists AhaSend and, for whoever signs in with Google, Google; WorkOS and Brevo leave it.
- Unverified, to confirm when opening the accounts: whether AhaSend or Lettermint ask for a card or a review before sending, and whether Google brand verification accepts the domain.
