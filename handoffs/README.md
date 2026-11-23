# Hand-offs

Each file is a prompt to paste into a new session. `todo/` holds the ones not run yet; `done/` the ones carried out. When a session finishes a hand-off, `git mv` it from `todo/` to `done/`, update every path that points at it (`git grep handoffs/`), and add its line below.

## To do, in this order

| Hand-off | What it is | Note |
|---|---|---|
| none | | |

## Done

| Hand-off | What it was | Result |
|---|---|---|
| [`done/admin-metrics-re-evaluation.md`](done/admin-metrics-re-evaluation.md) | For Arjel: judge every metric on the five Admin pages, then write the metric sheet, the spec and the tickets | Done 2026-11-13. 36 figures judged and 5 added; the sheet is `src/portals/admin/docs/metrics.md` and the glossary `src/portals/admin/CONTEXT.md`. Joaquin approved the verdicts; the spec is SCRUM-260 [S8-08]. Its children are Web #115–#127 and DB#62, landing on `admin-metrics-batch`. The Sandbox seed rows stay open in DB#61 |
| [`done/admin-metrics-tickets.md`](done/admin-metrics-tickets.md) | For Arjel: work SCRUM-260's children (Web #115–#127, DB#62), one ticket per fresh session, onto `admin-metrics-batch` | Done 2026-11-18. All 14 tickets closed, and DB#61 (the Sandbox seed rows) too. The batch reached main with its follow-ups (#128, #129, the batch-review fixes, `d39b9abb` cleanups), and the branch was deleted. The Status lines are in `src/portals/admin/docs/metrics.md` |
| [`done/email-revamp.md`](done/email-revamp.md) | For the codev: brand every email (Auth templates and notification emails), add the Acknowledgement Receipt email and the Payment Confirmation emails with PDFs | Tier 1 done 2026-11-23 on the `email-revamp` branches (DB and Web) and live on the Sandbox: l116, `send-email-queue` v24, the new secrets, the sender name and the three Auth templates. Not yet checked in a real inbox, and no defense screenshots; that and Tier 2 are follow-ups |
