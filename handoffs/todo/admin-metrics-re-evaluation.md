# Hand-off prompt: re-evaluate the Admin Portal's metrics

**Written 2026-11-05 by Joaquin, for Arjel.** Not run yet.

The panel may ask: "Tell us about the metrics you tracked. What does each one mean? Why did you choose it? What does it tell you? Why is it important to track?" Right now we can't answer that for every figure on the Admin Portal, and some figures may be the wrong ones. Your job is to judge every metric, so we can defend each one or change it.

**Dates:**

| When | What |
|---|---|
| About Tue 2026-11-10 | Grill, sheet, spec and tickets done |
| About Sat 2026-11-14 | Cut-off for Joaquin's other fixes on the batch. Your metric tickets aren't bound by it: they have until the freeze |
| About Tue 2026-11-17 | Code freeze: the metric batch is on `main` by then |
| About 2026-11-22 to 27 | Defense (not firm yet) |

## How to run it

1. Pull `main` in `Capstone-LucenaPortal-Web`, and open a new session there so `CLAUDE.md` loads.
2. Type `/mattpocock-skills:grill-with-docs` and paste the prompt below as its arguments. You answer the questions: the metric decisions are yours.
3. When the grill is done and the sheet is written, type `/mattpocock-skills:to-spec` in the **same session**. Don't `/clear`: it writes the spec from the conversation.
4. Send Joaquin the verdict table. Wait for his OK.
5. Type `/mattpocock-skills:to-tickets`, still in the same session.
6. Then stop. Each ticket gets its own fresh session.

You have to type the commands in steps 3 and 5 yourself, because the agent can't start those two skills. The last section of the prompt lists what we already suspect: try to give your own answers before you read it.

## The branch

All of this work goes on one branch cut from `main`: `admin-metrics-batch`. Step 7 of the prompt creates it, and every ticket then lands on it.

**Do NOT merge that branch into `main` until the entire Admin metrics task is done: the grill, the sheet, the spec, and every issue and ticket that comes out of them.** Joaquin says when it merges.

Joaquin's other fixes land on the same branch, starting with #94 and #96 (the Super-staff Audit log), so you'll see their commits there. They aren't part of your task. Their cut-off is about 2026-11-14: the merge waits for whatever landed by then, but not for anything that missed it.

```text
Re-evaluate every metric on the Admin Portal (/admin) with me. I'm Arjel, Joaquin's co-dev. I make the metric calls; Joaquin reviews them before any tickets are cut. You grill me now. I'll run /to-spec and /to-tickets myself when you tell me it's time.

The goal
The panel may ask what each metric means, why we chose it, what it tells us and why it matters. By the end, I can answer that for every figure, or we've decided to change the figure.

Step 0: preflight
Check these, and tell me everything missing in one list. Stop only on the first two.
- git status is clean, and the repo is on an up-to-date main.
- The sibling clones exist: ../Capstone-LucenaPortal-DB and ../Central-System-Documents.
- gh works, and the Jira MCP (project SCRUM) can read a ticket.
- A Supabase MCP can read the Sandbox project zqsqenfoszgcunvpqvvg. If not, we do the grill anyway and I ask Joaquin how to run the number checks.
- .env.local exists and I can sign in at /employee as an admin. If not, I ask Joaquin. Only the number checks need this.
- Optional: ../docs/ph-lgu-compliance-standards.md and ../QA-Testing/exploration/how-it-works.md. Those two aren't in the repos above, so I may not have them.
Then save the section "Rules for every ticket session" below to your auto-memory, one note per rule, so my later fresh sessions follow them. Tell me if you can't.

Step 1: read
- CONTEXT-MAP.md and docs/agents/domain.md. Admin has no glossary yet. Write terms to src/portals/admin/CONTEXT.md, not GLOSSARY.md (this repo's docs win over the skill's wording), and update Admin's row in CONTEXT-MAP.md.
- ADRs in ../Central-System-Documents/docs/adr/: 0008 (Admin owns Service performance, Super-staff owns System health) and 0001 (the processing clocks, what they cover and what they don't).
- ../Central-System-Documents/citizens-charter.md and db-plan-08-admin-portal.md. ../Capstone-LucenaPortal-DB/docs/admin-surface-follow-ups.md.
- The code: src/portals/admin/features/{dashboard,yellow-card,incidents,booking,sla}/ and src/portals/admin/lib/aggregate.ts. The code is the truth. Anything older (the README, the specs in src/portals/admin/docs/, the QA figures table) may be out of date.
- Open Jira tickets near this: SCRUM-131, SCRUM-175, SCRUM-176.

Step 2: list the figures
From the code, list every figure on the five pages: tiles, their notes and deltas, charts, summary tables, alerts, and the SLA target and bands. There are about 30. Group them by page. Show me the list before we start.
In scope: Dashboard, Yellow Card, Incident Reports (route issue-reports), Convention Center, SLA Reports.
Out of scope: System Health (ADR 0008). Only flag Super-staff's super_metrics strip if its definitions disagree with Admin's.

Step 3: the grill
Go page by page. For each figure, tell me in one line what it really computes, then make me answer these five:
1. Answers what? The one question it answers, for which service.
2. Accurate? Does the label match what the formula computes?
3. Effectiveness or just volume? Does it show how well the service performs, or only how much activity there was? A volume count is allowed, but it has to be called that.
4. Direction? What do good and bad look like, and against what target?
5. So what? What would the Mayor do differently if it moved?
Then I give a verdict: Keep, Rename, Fix, Replace or Drop.
Push back like a panelist would, and invent awkward scenarios. Once I've answered a whole page, show me that page's items from "Starting evidence" below and make me defend or change my answers. Don't show them earlier. They're evidence to check, not conclusions.
After each service (Yellow Card, Incidents, LCC Bookings), step back: taken together, do its metrics show whether the service is effective? What's missing? Dashboard and SLA Reports are roll-ups, not services: ask whether they roll up fairly.
Resolve vague words as they come up and write them to CONTEXT.md straight away. If a decision is hard to reverse, surprising and a real trade-off, offer an ADR. One that spans repos goes in Central-System-Documents. Say so plainly if a verdict contradicts an ADR.

Step 4: check the numbers
For the four Dashboard tiles and each service page's headline tiles, compare what the screen shows with read-only SQL on the Sandbox (zqsqenfoszgcunvpqvvg). Counts and aggregates only: never select or print names, contacts or other personal data. No writes, no migrations, and never any project but the Sandbox: it's also the defense environment. Use the same date range on screen and in SQL. Run only one next dev at a time. A mismatch goes on the proposed-issues list as a bug.

Step 5: write the sheet
Write src/portals/admin/docs/metrics.md, in words I could say out loud to a panel. For each figure:
- What it means, and the question it answers
- How it's computed (formula, source view, file:line)
- Why we chose it, and why it matters
- What good and bad look like
- The hardest question a panelist could ask, and our answer
- Its known limits
- The verdict, and today's status if the fix isn't in yet
Add a short section per service: how we'd say whether it's effective, and what we can't measure yet and why. Put the verdict table at the top. If the sheet changes after a ticket lands, that ticket updates it.

Step 6: spec, review, tickets
What can change: anything ticketed and merged before the freeze (about 2026-11-17), including formula fixes and small migrations. New data capture that needs a product decision stays out unless the grill shows the demo needs it. Argue the two obvious cases either way: booker origin (submit_booking doesn't record it, and old rows can't be backfilled) and the Booking clock (ADR 0001 records SCRUM-131 as cut, so reopening it means saying that ADR changes).
- Tell me to type /mattpocock-skills:to-spec. The spec goes in a new SCRUM ticket's description, per docs/agents/issue-tracker.md, because no ticket covers this. Draft the ticket first with labels capstone-lucenaportal-web and lane-code, assignee me, and show me the draft. A Jira write is Joaquin's call: I ask him, and I ask him for the memo ref. Don't invent one.
- Then tell me to send Joaquin the verdict table and wait for his OK.
- Then tell me to type /mattpocock-skills:to-tickets. Engineering tickets are GitHub issues with a "Parent: SCRUM-…" first line, ranked by what a panel would actually challenge. DB work goes to -R Capstone-LucenaPortal/Capstone-LucenaPortal-DB. Label pre-defense only if a panelist would see it on the usual demo path without anyone going looking. Severity doesn't decide that.

Step 7: finish
Nothing goes to main. Check git branch -r: if Joaquin has opened another batch, ask him which to use. Otherwise branch off main: create the batch branch from origin/main, named admin-metrics-batch, with git switch --no-track -c. Do NOT merge this branch into main until the entire Admin metrics task is done, with every issue and ticket that comes out of it, and Joaquin says so. Commit the sheet, CONTEXT.md, CONTEXT-MAP.md and this hand-off's move as one commit: git mv handoffs/todo/admin-metrics-re-evaluation.md to handoffs/done/, update handoffs/README.md (move its row to Done, with the result) and any path that points at it (git grep handoffs/). Push it to the batch branch.
End with: what was decided; the links; a section headed "Proposed tickets / issues to file", listing every candidate from the whole session with its title, why it matters and whether it's filed; and a plain line telling me to clear and start each ticket in a fresh session. Don't start implementing here, even if I answer something that sounds like a go-ahead.

Rules for this session
- Read the ticket, its parent and siblings, the specs and the ADRs before you ask me anything. Look up facts yourself; only decisions are mine.
- Read Jira freely. Ask before any write. Joaquin decides Jira writes, ticket by ticket.

Rules for every ticket session
- Check first: read the ticket, its parent and siblings, and the ADRs before asking how to do it. Only ask what they leave open.
- One commit per ticket: commit only when the whole ticket is done and tests pass, because QA pins a run to one SHA per ticket.
- Batch branch: ticket work goes on admin-metrics-batch (unless Joaquin names another), one commit per ticket. When a ticket is done, rebase onto origin/admin-metrics-batch, run tsc and the full suite, then git push origin HEAD:admin-metrics-batch. Do this without being asked, as the last step. Joaquin's other fixes, starting with #94 and #96, land on this branch too: leave their commits alone.
- Never push to main, and never merge admin-metrics-batch into it. The branch stays unmerged until the entire Admin metrics task is done, with every issue and ticket that comes out of it. Then the whole batch reaches main together, as one fast-forward, only when Joaquin says so. A fix never goes ahead of the rest.
- Ticket branches: create them with git switch --no-track -c <branch> origin/admin-metrics-batch. A branch tracking origin/main lets VS Code's Sync Changes push it straight onto main.
- No Smoke per ticket. Check a fix with tests and one look on the dev server, then comment "Fixed in <sha> on admin-metrics-batch" on the issue. Joaquin runs one full Smoke after the batch merges, then the re-tests and the held Core regression.
- Migrations: applying one to the Sandbox needs Joaquin's yes, because it's also the defense environment. Leave DB#31 alone: it isn't part of this work. Joaquin's fixes add migrations too, so check the DB repo's newest number and take the next free one when you apply.
- CI runs Node 24.20. If your node differs, before pushing run: npx -y -p node@24.20.0 node node_modules/vitest/vitest.mjs run
- Run the full test suite on its own, with no other vitest or agents beside it, and rerun a surprise red before believing it. Run only one next dev at a time, and stop it when the check is done.
- Browser checks with Claude in Chrome: check document.visibilityState first. In a hidden tab real clicks silently miss and screenshots time out, so use in-page el.click(), and pair every "nothing happened" check with a control that must work. A click that never landed looks like a pass.
- Worktrees: reuse a slot by switching branches rather than making a new worktree per ticket. A fresh npm ci is slow on Windows.
- Commands I have to run with !: one short line, no cd, short SHAs. Long ones wrap when pasted and run as two commands.
- At the end of a ticket: list every follow-up under "Proposed tickets / issues to file" (title, why it matters, filed or only proposed), suggest deleting any branch that's merged with nothing waiting on it, and end with: "The current ticket is now done and you can do another ticket."

Starting evidence (hold back per page, as Step 3 says)
Checked against main @ eb1d928 on 2026-11-05. Verify each one anyway.
Dashboard
- Citizens engaged adds up Yellow Card applications, incident reports and bookings filed in range (dashboard.ts). It counts submissions, not people: one citizen filing three times counts as three.
- Days with an event counts every status except cancelled, so a pending booking counts as an event day. Its variable is still called lccUtilizationPct.
Incident Reports and SLA Reports
- Avg Response is averageResolutionDays: submitted to resolved. So it's resolution time, labelled as response time, and it includes routing and triage delay. No tile shows time to first response. db-plan-00 names a time_to_triage metric as the mitigation for triage delay; the view has had the column since l42. Does any figure show it?
- Open Backlog's note always reads "SLA breach count unavailable — pending DB support". A panelist will see that.
- Resolution Rate divides by every report in range, so recent reports still in progress pull it down. Fair, or not?
Yellow Card
- Pending Review's note always reads "SLA status unavailable for pending applications". SCRUM-183 gave staff a pre-deadline warning: can the same due date reach the Admin view?
- Approval Rate is approved ÷ (approved + rejected). Is a high rate good? It could mean good applicants or weak review.
Convention Center
- Utilization, Resident Share and Outside Lucena always read "Not tracked", but the page subtitle says "Utilization and resident vs outside Lucena breakdown". Only 1 of the 4 tiles shows a number.
- Bookings by venue may ignore the date range (QA read it as all time, every status). Check it.
- Booking has no agency-side clock, so one of three services is missing from SLA Reports. ADR 0001 records SCRUM-131 as cut.
SLA Reports
- The 85% target: the code comment (sla.ts) calls it "capstone-mandated", and our compliance doc (S4) says it's capstone-chosen with no legal basis, since RA 11032 allows no tolerance. An older spec says 95%. The doc's advice: keep 85% as an internal health band, and also show how many transactions breached and which. Mandated by whom? Have the answer ready.
- Compliance, Responses and Violations mix incidents with Yellow Card, while the trend and Avg Response are incidents only. Yellow Card's clock pauses and an incident's doesn't, and ADR 0001 puts incidents outside RA 11032's clocks entirely. Is "SLA" one thing here?
All pages
- Deltas don't say good or bad: KpiTile renders positive and negative notes in the same grey, so "+12% reports" reads the same whatever it means.
- The QA figures table (how-it-works.md, read at f375cd7) is out of date on at least two rows: Resolution Rate now leaves out invalid, duplicate and expired closures (#18), and Avg Response now shows "—" instead of "0d" when nothing is resolved.
```
