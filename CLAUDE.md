# Capstone-LucenaPortal-Web

@AGENTS.md

## Agent skills

### Issue tracker

Jira is the main tracker; GitHub holds its engineering children:

- **Jira**, project `SCRUM` — every unit of planned work: memo refs (`[S5-01]`), epics, sprints.
  Read freely via `mcp__jira__*`; ask before any write.
- **GitHub issues** on this repo's own remote — miscellaneous engineering child tickets cut from a
  Jira ticket (each with a `Parent: SCRUM-…` line), plus bugs and triage. `gh` infers the repo, so
  **no `-R`**.

Specs and wayfinder maps stay on disk under `.scratch/<feature-slug>/`. See
`docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles, used verbatim as GitHub labels. See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context — `CONTEXT-MAP.md` at the root indexes the five Portals, each with its own
`CONTEXT.md` and `docs/adr/` in `src/portals/<portal>/`. System-wide ADRs (including the merge,
0003–0006) live in `Central-System-Documents/docs/adr/`. See `docs/agents/domain.md`.
