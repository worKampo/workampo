-- Users and identities of the fake identity provider (apps/api/src/_shared/identity/fake-identities.ts),
-- and one expired session: the fixtures of the access tests and E2E.
INSERT INTO users (id, email, created_at, updated_at) VALUES
  ('01940000-0000-7000-8000-000000000001', 'linked@example.com', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('01940000-0000-7000-8000-000000000002', 'taken@example.com', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('01940000-0000-7000-8000-000000000003', 'renamed.old@example.com', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('01940000-0000-7000-8000-000000000004', 'clash@example.com', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('01940000-0000-7000-8000-000000000005', 'google@example.com', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')
ON CONFLICT DO NOTHING;

INSERT INTO identities (provider, subject, user_id, created_at) VALUES
  ('workos', 'fake|linked', '01940000-0000-7000-8000-000000000001', '2026-01-01T00:00:00.000Z'),
  ('workos', 'fake|taken-old', '01940000-0000-7000-8000-000000000002', '2026-01-01T00:00:00.000Z'),
  ('workos', 'fake|renamed', '01940000-0000-7000-8000-000000000003', '2026-01-01T00:00:00.000Z'),
  ('workos', 'fake|clash', '01940000-0000-7000-8000-000000000004', '2026-01-01T00:00:00.000Z'),
  ('workos', 'fake|google', '01940000-0000-7000-8000-000000000005', '2026-01-01T00:00:00.000Z')
ON CONFLICT DO NOTHING;

-- Token 'seed-expired-session', stored as its SHA-256. Expired since 2026-01-31: it opens nothing.
INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, revoked_at) VALUES
  ('01940000-0000-7000-8000-000000000101', '01940000-0000-7000-8000-000000000001',
   '20d6623fba58d3b2a055cb6c362b8ffabf047a528299ebf70088f1b7d8b3ba3c',
   '2026-01-01T00:00:00.000Z', '2026-01-31T00:00:00.000Z', NULL)
ON CONFLICT DO NOTHING;
