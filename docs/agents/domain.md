# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

This is a **multi-context** repo — one app holding five Portals, each its own bounded context in
`src/portals/<portal>/`, indexed by `CONTEXT-MAP.md` at the root.

## Before exploring, read these

- **`CONTEXT-MAP.md`** at the repo root — it points at each Portal's `CONTEXT.md` and ADRs, and
  carries the terms that span Portals (such as **Portal** itself).
- **The Portal's own `CONTEXT.md` and `docs/adr/`** — `src/portals/<portal>/CONTEXT.md` and
  `src/portals/<portal>/docs/adr/` for the Portal whose path prefix you're working under. For
  a cross-Portal question, read every Portal it touches.
- **System-wide ADRs** — `Central-System-Documents/docs/adr/`, cloned as a sibling at
  `../Central-System-Documents/docs/adr/`. Decisions spanning Portals or repos, including the
  merge itself (0003–0006).

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

```
/
├── CONTEXT-MAP.md                  ← the index of Portal contexts
└── src/portals/
    ├── citizen/
    │   └── CONTEXT.md
    ├── staff/
    │   ├── CONTEXT.md
    │   └── docs/adr/               ← Portal-scoped decisions, old numbering kept
    ├── super-staff/
    │   └── CONTEXT.md
    ├── responder/
    └── admin/
```

This repo holds only Portal-level ADRs. There is no root `docs/adr/`.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a
hypothesis, a test name), use the term as the owning Portal's `CONTEXT.md` defines it. The same
word can mean different things in different Portals — name the Portal whenever a term is
ambiguous ("_incident_ in the Staff sense"), and don't import one Portal's definition into
another.

If the concept you need isn't in any glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_

Check both scopes: the system-wide ADRs in Central-System-Documents and the Portal's own. A
system-wide ADR outranks a Portal's; contradicting one is a bigger deal and should be raised as
such.

## Where new domain docs go

- A term used by exactly one Portal → that Portal's `CONTEXT.md`.
- A term several Portals share, or one whose meaning differs per Portal → `CONTEXT-MAP.md`.
- A decision affecting one Portal → that Portal's `docs/adr/`.
- A decision affecting several Portals, or another repo → `Central-System-Documents/docs/adr/`.
