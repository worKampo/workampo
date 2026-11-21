---
status: accepted
date: 2026-11-21
related: [8, 14, 27, 29, 53, 63, 65]
---

# ADR-0071: Identity and email providers as plug-ins; WorkOS for the MVP, our own login ready to plug in

## Context

The person first asked for strict EU data residency (2026-11-21). Three spikes checked the providers:

- **WorkOS** (identity, [ADR-0008](0008-own-session-in-d1-host-only-cookie.md)) has no EU region; data is processed in the US under standard contractual clauses (issue 23). It is free, has hosted sign-in (code, link, Google) and sends its own sign-in emails from its domain.
- **No managed identity provider** meets "EU only", "free" and "branded sign-in emails in Spanish and English" at once (issue 65: Clerk, Kinde, Zitadel, Ory, Logto, Hanko). Our own login on D1 meets them, at 6 to 9 days of work.
- **Brevo** (email, [ADR-0063](0063-eu-data-residency.md), [ADR-0014](0014-buying-a-domain-is-a-config-change.md)) has subprocessors in the US and India and brands free emails. **No EU email service sends from `*.workers.dev`**: every one needs our own domain with SPF, DKIM and DMARC (issue 66). AhaSend and Lettermint (Netherlands, free, no card) meet the rule.

Then the person decided to reach the MVP with WorkOS and leave our own login for later, with every piece ready to plug in, so nothing built now is thrown away and WorkOS stays an option for customers it suits.

## Decision

Decided by the person in issue 65 (2026-11-21).

1. **Identity behind an interface, every provider a plug-in** ([ADR-0053](0053-code-conventions.md)):
   - `_shared/auth/` defines an identity interface: start a sign-in, complete it, and return a **verified identity** (provider, subject, email, name, email verified). WorkOS is one implementation; our own login (email code and Google) will be another.
   - The session (ADR-0008), users, companies and roles stay outside every provider. A user stores the provider and the subject they signed up with.
   - **Sync on sign-in, no webhook needed**: every sign-in returns the current identity, and we create or update our user then. What we do flows outward: deleting an account calls the provider's API through the adapter. A provider that sends useful events receives them in its own adapter (its route, signature check, event registry as ADR-0053 sets), which calls the same internal functions our own login calls directly. The interface knows nothing of webhooks.
   - **One function picks the provider**, `chooseProvider`, configured per environment. Its rules, in order: an existing user keeps their provider; an invitation to a company that demands a provider uses it; a per-country rule for a new person (from `request.cf.country`); else the environment's default. Sign-in asks for the email first (identifier-first) to know whether the person exists. In the MVP only WorkOS is registered and the function always returns it.
   - No code outside `_shared/auth/` imports a provider; dependency-cruiser enforces it. One contract test suite runs against every implementation, the fakes included ([ADR-0029](0029-testing-strategy.md)).
2. **WorkOS for the MVP.** Whoever signs in during the MVP (the person and trial users) has their email and name processed by WorkOS in the US under standard contractual clauses; the privacy policy ([ADR-0027](0027-legal-and-data-protection.md)) says so. Strict EU residency becomes the target of our own login, which is planned after the MVP and can be moved back into it.
   - **WorkOS gets only the email.** It cannot get less: it sends the sign-in code or link to that address, and a pseudonymous alias is still personal data under the GDPR. The name, company data and everything else are asked for and stored in our app, never sent to WorkOS. With Google, WorkOS receives what Google returns for `openid email profile`; we read only the email from it and ask for the rest ourselves.
   - Deleting an account deletes the identity at WorkOS through the adapter. WorkOS still sees the IP and browser of each sign-in, for its own security.
   - Before real users: the privacy policy names WorkOS, where it processes data and with which safeguards (DPA with standard contractual clauses), and a short transfer assessment is kept with it. Whether WorkOS is certified under the EU–US Data Privacy Framework is to confirm. This meets the GDPR, which allows transfers with safeguards; it does not meet the stricter "EU only" rule, which is a business choice for customers who demand it.
3. **Email behind an interface too.** `_shared/email/` defines a sender that receives an already rendered message; the templates (React Email or jsx-email, Spanish and English) are rendered outside it, so changing sender never touches them. Implementations:
   - **Outbox** in local and staging: it stores each email in that environment's database, and a staging-only page `/__dev/outbox` shows them. It never exists in production, and the production build fails if it includes it. Staging holds test data only.
   - **AhaSend** in production, **Lettermint** as fallback.
   WorkOS sends its own sign-in emails; ours are the product's (invitations, notices).
4. **A domain before real recipients of our emails.** Buying the domain (about 10 € a year, ADR-0014) is the person's explicit spend. Until then our emails land in the outbox; then AhaSend is configured with SPF, DKIM and DMARC.

This supersedes:

- In ADR-0063, "confirm a WorkOS EU region": there is none, and WorkOS is accepted for the MVP as point 2 says; the Brevo row gives way to the email service of point 3.
- In ADR-0014, Brevo as the sending service in the "Email by stages" table: outbox before the domain, AhaSend after it. Receiving mail on the domain stays as ADR-0014 says.
- Wherever another ADR names Brevo as the sender, read this ADR. ADR-0008 stands: WorkOS only verifies who the person is, now as one implementation of the identity interface.

## Consequences

- PRD 10 is unblocked and stays light: no sign-in core to write in the MVP.
- Moving a user from WorkOS to our own login, or adding a provider for a customer or a country, is a new implementation and a rule in `chooseProvider`, not a rewrite. Accounts move by verified email, because the user records and the session are ours.
- Post-MVP issues: our own login (the EU implementation) and provider selection per company and country.
- Unverified, to confirm when opening the accounts: whether AhaSend or Lettermint ask for a card or a review before sending.
