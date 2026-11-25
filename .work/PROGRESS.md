# Progress

PRD #10 · Ticket #91 elegir-empresa-al-entrar-y-cambiar-de · Branch: feature/91-elegir-empresa-al-entrar-y-cambiar-de
Step: Build › Implement (wave 4)
Done in this step: plan and tasks approved (2026-11-25); Security section in the issue; follow-up #178; T1 (a7b122d spec and scenarios, 00135dd it.fails tests); wave 2 T2–T5, T13 (b62b5d5, 4407510, ebdccc3, ded3eb4, 063b741). safeReturnTo has no URL origin check (domain has no URL type; the earlier checks already keep it path-absolute) and refuses dot segments and %2e; wave 3 T6–T9 (ecf7a52, 1d2a446, 8e3e118, 76f3a04). SignOutButton in _shared only draws (props), pages wire useSignOut. /login validateSearch always returns both keys (TanStack keeps raw keys a validator omits)
In progress: —
Next: wave 4 (T10 picker). T10/T11 remove the remaining it.fails of sign-in.route.test.tsx that wait on / and the picker. For Verify: a returnTo near 1024 non-ASCII characters can exceed the 4 KB cookie once encoded (fails closed with invalid_state); cap the encoded length. The T1 report lists the names and shapes the tests pin. Page hooks stay in app-core in this ticket; #179 moves them to the apps afterwards (the person, 2026-11-25).
Waiting for human: —
Open questions: —
Updated: 2026-11-25 14:35
