# Admin metrics: work the SCRUM-260 tickets, one per session

> **Status: done (2026-11-18).** All 14 tickets are closed: Web #115–#127 and DB#62. DB#61, the
> Sandbox seed rows, is closed too. `admin-metrics-batch` reached main on 2026-11-18 together with
> its follow-ups:
> - #128: Yellow Card Export is off while an SLA filter is on
> - #129: a rejected report can be past due while awaiting triage
> - fixes from the batch review: lists past 1,000 rows, Export buttons wait for data, SLA row filter
> - `d39b9abb`: metrics cleanups
>
> The branch has since been deleted. The figures and their Status lines are in
> `src/portals/admin/docs/metrics.md`. Don't paste the prompt below again; it is kept as a record.

Paste this into a fresh session. Each session does **one** ticket, then stops. Clear and paste it
again for the next one.

```text
I'm Arjel. We're working the children of SCRUM-260 [S8-08], "Admin Portal metrics: fix, rename
and add figures per the metrics sheet". Do one ticket in this session. If I name one, do that.
If I don't, take the first ticket in the table below whose blockers are all closed and that
nobody is assigned to, then tell me which ticket it is before you start.

Where things are
- Spec: SCRUM-260's Jira description. Jira is the source.
- The sheet: src/portals/admin/docs/metrics.md on admin-metrics-batch. What each figure means,
  the verdict, and the Sandbox values today and after the fix. The Tickets table at its end maps
  each ticket to its figures.
- Glossary: src/portals/admin/CONTEXT.md. Use its words on screen.
- ADRs: ../Central-System-Documents/docs/adr/ 0001 (the processing clocks) and 0008 (Admin owns
  Service performance).
- Branch: origin/admin-metrics-batch. Every ticket lands there.

The tickets, ranked by what a panel would challenge first
| Rank | Ticket | Blocked by | Figures |
| 1 | Web #115 Effectiveness deltas say better or worse | none | Deltas |
| 2 | Web #119 SLA compliance per service, one set of scoring rules | #115 | D3, D5 |
| 3 | Web #122 SLA Reports tiles per service, plain names | #119 | S1-S3, S5-S9 |
| 4 | Web #116 "Service requests filed"; backlog of work waiting on the city | none | D1, D2, Y4 count |
| 5 | Web #123 Decided on time; Approval Rate as an outcome mix | #115, #119 | Y7, Y2 |
| 6 | DB#62 Admin views expose due time, deadline state and at-risk | none | Y4, I4, I9, S4 |
| 7 | Web #124 "N past due · M at risk" notes | #116, DB#62 | Y4, I4 |
| 8 | Web #125 Resolved on time; never-clocked reports not scored | #115, #119, #124 | I9, D3, S3 |
| 9 | Web #126 Past due now replaces Avg Response | #122, #124 | S4 |
| 10 | Web #120 Resolution Rate; Avg time to resolve | #115 | I2, I3 |
| 11 | Web #121 Triage leaves out reopened reports; Avg time to triage | #115 | I8, I10 |
| 12 | Web #117 Event days counts confirmed events only | none | D4, C2 |
| 13 | Web #118 Convention Center tidy-up | none | C1, C3, C4, C7, C8 |
| 14 | Web #127 Finished late and Past due now link to their requests | #122, #126 | S2, S4 |
The blocking links are native on GitHub. Check them with gh before picking:
gh api repos/Capstone-LucenaPortal/Capstone-LucenaPortal-Web/issues/<n>/dependencies/blocked_by

Step 1: read before asking
Read the ticket (gh issue view <n> --comments), SCRUM-260, the sibling tickets it names, the
sheet's entries for its figures, and the two ADRs. Read the code it touches under
src/portals/admin/. The code is the truth; line numbers in the sheet were checked at 02708153 and
may have moved. This is not the Next.js you know: read node_modules/next/dist/docs/ before
writing Next.js code. Then ask me only what those leave open.

Step 2: branch
git fetch origin, then git switch --no-track -c <short-branch> origin/admin-metrics-batch.
Never base a ticket branch on main, and never let it track origin/main. If a worktree already
exists, reuse it by switching branches; don't make a new worktree.

Step 3: build it test-first
- The main seam is the page tests. They mock only the data fetch functions and the catalogs, and
  run the real figure code. Each acceptance criterion gets a page test that fails first.
- Function tests (aggregate, sla, dashboard) take only the edge cases the ticket names.
- Test what the Administrator sees: label, value, caption, delta wording, link. Never internal
  helper names.
- Update the figures' Status lines in metrics.md so the sheet says what is now true.

Step 4: check it
- Typecheck, then the full suite, on its own with no other vitest or agents running. CI runs
  Node 24.20; if node -v differs, run:
  npx -y -p node@24.20.0 node node_modules/vitest/vitest.mjs run
  Rerun a surprise red before believing it.
- One look on the dev server: one next dev at a time, at localhost:3000 (not 127.0.0.1). Sign in
  at /employee as an admin; admin views need aal2. Use the Annual preset and compare with the
  ticket's Sandbox values. Stop the server when done.
- In Claude in Chrome, check document.visibilityState first. A hidden tab needs in-page
  el.click(), and every "nothing happened" check needs a control that must work.
- No Smoke per ticket. Joaquin runs one full Smoke after the batch merges.

Step 5: land it
- One commit for the whole ticket, made only when it is done and green. QA pins one SHA per
  ticket. Commit only the ticket's files: never .scratch/ or .superpowers/.
- Rebase onto origin/admin-metrics-batch, run typecheck and the full suite again, then
  git push origin HEAD:admin-metrics-batch. Do this without being asked.
- Joaquin's own fixes land on admin-metrics-batch too. Leave his commits alone.
- Comment "Fixed in <short sha> on admin-metrics-batch" on the issue. Ask me before closing it:
  closing is what unblocks the tickets that wait on it.

Rules
- Never push to main, and never merge admin-metrics-batch into it. The whole batch reaches main
  together, as one fast-forward, only when Joaquin says so.
- Jira: read freely, ask before any write. Joaquin decides Jira writes.
- Sandbox (zqsqenfoszgcunvpqvvg) is also the defense environment. Read-only SQL, counts and
  aggregates only: never select or print names, contacts or other personal data. Test only with
  qa.* accounts and "TEST - JP -" records. Never touch any other Supabase project.
- Commands I have to run with ! must be one short line, with no cd and short SHAs.

Ticket-specific notes
- DB#62 is in ../Capstone-LucenaPortal-DB; follow that repo's CLAUDE.md. Take the next free
  migration number after the newest one on its origin/main (l111 when this was written; Joaquin's
  fixes add more). Write the contract and behaviour asserts (assert_lNN.sql and
  assert_lNN_behaviour.sql, the l111 precedent); the behaviour file's writes must not commit
  (DB#54). Applying it to the Sandbox needs Joaquin's yes, given once both asserts pass, so ask
  me to get it. Leave DB#31 alone.
- Yellow Card values are provisional. On the Sandbox, 12 seed rows score as decided on time (DB#61,
  Joaquin's call). Decided on time and Yellow Card compliance read 76.0% with them and 53.8%
  without. Don't try to fix the data in a ticket.
- Expect values in between. After #119 and before #122, SLA Reports' pooled tile reads 63.6%.
  Until #125 lands, incident compliance reads 47.4% (9 of 19), not 52.9%.
- #127: if the table filter is more than a small change to the Yellow Card and Incident Reports
  pages, stop, comment on the issue, and tell me. It moves to post-defense.

When the ticket is done, end with:
- "Proposed tickets / issues to file": every follow-up you found, each with its title, why it
  matters, and whether it is filed or only proposed.
- A suggestion to delete the ticket branch once it is on admin-metrics-batch with nothing waiting
  on it.
- This line: "The current ticket is now done and you can do another ticket."
```
