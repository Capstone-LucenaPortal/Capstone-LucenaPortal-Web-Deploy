# Staff Portal (src/portals/staff)

The repo-wide agent setup — issue trackers, triage labels, domain docs — is in
the root `CLAUDE.md`. Staff's glossary is `CONTEXT.md` and its ADRs are
`docs/adr/`, both in this folder.

## Standards

### Clocks

`new Date()` belongs at the top of a render — a route, or a module's `dashboard-card.ts` — and a render-top creates exactly one. Lint enforces the first half (root `eslint.config.mjs`); the second is prose. See `src/portals/staff/docs/adr/0005-render-top-clock-rule.md`.
