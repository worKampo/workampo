---
status: accepted
date: 2026-11-21
related: [8, 27, 53, 63, 65]
---

# ADR-0071: Identity providers as plug-ins; WorkOS for the MVP, our own login ready to plug in

## Context

The person first asked for strict EU data residency (2026-11-21). Two spikes checked the identity providers:

- **WorkOS** ([ADR-0008](0008-own-session-in-d1-host-only-cookie.md)) has no EU region; data is processed in the US under standard contractual clauses (issue 23). It is free, has hosted sign-in (code, link, Google) and sends its own sign-in emails from its domain, so it needs no domain or email service of ours.
- **No managed identity provider** meets "EU only", "free" and "branded sign-in emails in Spanish and English" at once (issue 65: Clerk, Kinde, Zitadel, Ory, Logto, Hanko). Our own login on D1 meets them, at 6 to 9 days of work, and needs an email service and a domain.

Then the person decided to reach the MVP with WorkOS and leave our own login for later, with every piece ready to plug in, so nothing built now is thrown away and WorkOS stays an option for customers it suits.

## Decision

Decided by the person in issue 65 (2026-11-21).

1. **Identity behind an interface, every provider a plug-in** ([ADR-0053](0053-code-conventions.md)):
   - `_shared/auth/` defines an identity interface: start a sign-in, complete it, and return a **verified identity** (provider, subject, email, email verified, and the name only if the provider has it). WorkOS is one implementation; our own login (email code and Google) will be another.
   - The session (ADR-0008), users, companies and roles stay outside every provider. **Our user id is the account's key.** A table of identities maps each provider and subject to one user, unique per pair; one user can have several identities.
   - **Linking**: on sign-in, a known provider and subject opens its user. An unknown pair with a **verified** email that matches an existing user's **verified** email is linked to that user; otherwise a new user is created. A user stores only a verified email (a new user's is stored once its provider verified it), and the lookup ignores anything else, so an unverified email never links and never takes over an account. That is how an account survives a change of provider, even when the new provider returns another subject.
   - **Sync on sign-in, no webhook needed**: every sign-in returns the current identity, and we update our user then. What we do flows outward: deleting an account calls each provider's API through its adapter. A provider that sends useful events receives them in its own adapter (its route, signature check, event registry as ADR-0053 sets), which calls the same internal functions our own login calls directly. The interface knows nothing of webhooks.
   - **One function picks the provider**, `chooseProvider`, configured per environment. Its rules, in order: a company the person is entering that demands a provider uses it; else an existing user keeps a provider they already have; else a per-country rule for a new person (from `request.cf.country`); else the environment's default. If a company demands a provider the person has no identity with, they sign in with it once and the new identity is linked by verified email; without a verified match, access to that company is refused until it is linked. Sign-in asks for the email first (identifier-first) to know whether the person exists. In the MVP only WorkOS is registered and the function always returns it.
   - No code outside `_shared/auth/` imports a provider; dependency-cruiser enforces it. One contract test suite runs against every implementation, the fakes included ([ADR-0029](0029-testing-strategy.md)).
2. **WorkOS for the MVP.** Whoever signs in during the MVP (the person and trial users) is processed by WorkOS in the US under standard contractual clauses; the privacy policy ([ADR-0027](0027-legal-and-data-protection.md)) says so. Strict EU residency becomes the target of our own login, which is planned after the MVP and can be moved back into it.
   - **What WorkOS receives**: with the email code or link, only the email (it cannot get less: it sends the sign-in message to that address, and a pseudonymous alias is still personal data under the GDPR). With Google, whatever Google shares with WorkOS: the email and, through the `profile` scope, the name and picture. We keep only the email from the identity and ask for the name and everything else in our app; we never send them to WorkOS. WorkOS also sees the IP and browser of each sign-in, for its own security.
   - Deleting an account deletes the identity at WorkOS through the adapter.
   - Before real users: the privacy policy names WorkOS, where it processes data and with which safeguards (DPA with standard contractual clauses), and a short transfer assessment is kept with it. Whether WorkOS is certified under the EU–US Data Privacy Framework is to confirm. This meets the GDPR, which allows transfers with safeguards; it does not meet the stricter "EU only" rule, which is a business choice for customers who demand it.
   - **Google is an exception to "EU only" in every implementation**: signing in with Google shares data with Google, under Google's own terms, for whoever chooses it; with our own login, the email code (on an EU email service) will be the EU-only way in. In the MVP no way in is EU-only, because WorkOS processes every sign-in in the US.
3. **Email is decided apart.** WorkOS sends its own sign-in emails. The product's emails (invitations, notices), their provider and the domain are pending in issue 66; until that decision, the Brevo row of ADR-0063 and the "Email by stages" table of ADR-0014 are under review, not in force for new work.

This supersedes, in ADR-0063, "confirm a WorkOS EU region": there is none, and WorkOS is accepted for the MVP as point 2 says. ADR-0008 stands: WorkOS only verifies who the person is, now as one implementation of the identity interface.

## Consequences

- PRD 10 is unblocked and stays light: no sign-in core to write in the MVP, and no domain or email service needed to sign in.
- Zero spend first (the person, 2026-11-21): the product is built and tested with what costs nothing; the domain, the email service and our own login are evaluated again only when the zero-spend options run out ([ADR-0065](0065-zero-spend-and-free-tier-limits.md)).
- Moving a user from WorkOS to our own login, or adding a provider for a customer or a country, is a new implementation and a rule in `chooseProvider`, not a rewrite: identities link to our users by verified email.
- Post-MVP issues: our own login (issue 68) and provider selection per company and country (issue 69).
