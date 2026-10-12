## Attendees
Maria López (Acme, PM), Carlos Ruiz (Acme)

## Decisions
- Go back to Firebase for auth: Supabase's EU region does not meet Acme's data residency requirement.

## Action items
- Revert the auth branch to Firebase — Carlos Ruiz — 2026-12-20

## Facts & numbers
- Budget is 70000 EUR.

## Open questions
None

## Risks
None

## Summary
Auth review for the Acme website. Acme's legal team requires EU data residency, which Supabase's region does not meet, so the team returns to Firebase for auth. Carlos will revert the auth branch.
