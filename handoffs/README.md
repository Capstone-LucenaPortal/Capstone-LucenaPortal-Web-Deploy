# Hand-offs

Each file is a prompt to paste into a new session. `todo/` holds the ones not run yet; `done/` the ones carried out. When a session finishes a hand-off, `git mv` it from `todo/` to `done/`, update every path that points at it (`git grep handoffs/`), and add its line below.

## To do, in this order

| Hand-off | What it is | Note |
|---|---|---|
| [`todo/admin-metrics-re-evaluation.md`](todo/admin-metrics-re-evaluation.md) | For Arjel: judge every metric on the five Admin pages, then write the metric sheet, the spec and the tickets | Written 2026-11-05. Grill and tickets by about 2026-11-10, freeze about 2026-11-17, defense about 2026-11-22 to 27. Stops at filed tickets. Joaquin reviews the verdict table before `/to-tickets` |

## Done

| Hand-off | What it was | Result |
|---|---|---|
