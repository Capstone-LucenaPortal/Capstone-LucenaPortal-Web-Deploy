# Hand-offs

Each file is a prompt to paste into a new session. `todo/` holds the ones not run yet; `done/` the ones carried out. When a session finishes a hand-off, `git mv` it from `todo/` to `done/`, update every path that points at it (`git grep handoffs/`), and add its line below.

## To do, in this order

| Hand-off | What it is | Note |
|---|---|---|
| [`todo/admin-metrics-tickets.md`](todo/admin-metrics-tickets.md) | For Arjel: work SCRUM-260's children (Web #115–#127, DB#62), one ticket per fresh session, onto `admin-metrics-batch` | Written 2026-11-13. Freeze about 2026-11-17. Move it to `done/` when the last ticket lands |

## Done

| Hand-off | What it was | Result |
|---|---|---|
| [`done/admin-metrics-re-evaluation.md`](done/admin-metrics-re-evaluation.md) | For Arjel: judge every metric on the five Admin pages, then write the metric sheet, the spec and the tickets | Done 2026-11-13. 36 figures judged and 5 added; the sheet is `src/portals/admin/docs/metrics.md` and the glossary `src/portals/admin/CONTEXT.md`. Joaquin approved the verdicts; the spec is SCRUM-260 [S8-08]. Its children are Web #115–#127 and DB#62, landing on `admin-metrics-batch`. The Sandbox seed rows stay open in DB#61 |
