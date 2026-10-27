# Issue tracker: Jira is the tracker, GitHub holds its engineering children

**Jira is the main ticketing system.** Every piece of work starts as a Jira ticket. GitHub issues
are subordinate: miscellaneous engineering tickets cut *from* a Jira ticket when it needs breaking
down, plus bugs and triage that surface while coding.

| Ticket | Tracker |
| --- | --- |
| A unit of planned work — memo ref (`[S5-01]`), epic, sprint, estimate | **Jira**, project `SCRUM` |
| A child of one of those — an implementation slice, a bug, a triage item, a chore | **GitHub issues**, this repo's remote |

When unsure, it's Jira. A GitHub issue should always be traceable back to the Jira ticket it
serves (see "Linking" below); one that can't be is either a stray bug or a sign the plan ticket
is missing.

## Jira — the main tracker

Project `SCRUM` ("Capstone II"), cloudId `6b943e6b-1a7f-4f37-a730-8df69728b970`. Reached with
the `mcp__jira__*` tools — `getAccessibleAtlassianResources` once per session for the cloudId,
then `searchJiraIssuesUsingJql` and `getJiraIssue`.

The board spans every repo in the org. Work for this repo carries the label
`capstone-lucenaportal-web`, or one of the five archived Portal labels on tickets filed before
the merge:

```
project = SCRUM AND labels in ("capstone-lucenaportal-web", "capstone-lucenaportal-admin",
  "capstone-lucenaportal-enduser", "capstone-lucenaportal-lguresponder",
  "capstone-lucenaportal-staff", "capstone-lucenaportal-superstaff") ORDER BY created DESC
```

Four things the tools will not tell you:

- **A memo ref lives in the summary, not the key.** `[S5-01]` is `SCRUM-143`. Find one with
  `summary ~ "continuous integration"` or a `parent = <epic>` listing — a ref number and a key
  never line up, so treat a guessed key as wrong.
- **Labels carry the routing**: the repo (`capstone-lucenaportal-web`), the lane
  (`lane-code`) and the track (`track-c`). The repo label says which GitHub repo the work
  belongs in. An older ticket labelled for one of the five archived Portal repos
  (`capstone-lucenaportal-admin`, `-enduser`, `-lguresponder`, `-staff`, `-superstaff`) is
  worked here, in that Portal's `src/portals/<portal>/` folder.
- **A split ticket takes a letter suffix** — `[S5-01a]` — and is ranked beside its parent with
  `rankAfterIssue`. Appending the next free number instead buries a follow-on at the end of the
  sequence, where it reads as late-stage work.
- **Statuses follow
  [`ticket-workflow.md`](../../../Central-System-Documents/ticket-workflow.md).** A new issue
  starts in To Do. In Progress means the work has started and the assignee is set. In review
  means the implementer is checking their own work by using it, before merging. It does not
  mean someone else is reviewing it. Done means that check is recorded in a Jira comment and
  every branch is merged. The board enforces none of this, so treat a card as a claim, not proof.

Read freely. A **write** to Jira is the user's call, ticket by ticket: it is a shared board with
sprints and estimates, and filing or re-scoping a ticket there changes what other people see.
**The one standing exception:** on a ticket assigned to the user, an agent may move it to In
Progress or In review, and post the passthrough comment, without asking. It always asks before
moving a ticket to Done.
Ask, then write.

## GitHub — engineering child tickets

Child tickets live as GitHub issues on
[`Capstone-LucenaPortal/Capstone-LucenaPortal-Web`](https://github.com/Capstone-LucenaPortal/Capstone-LucenaPortal-Web).

This is a clone with a remote, so `gh` infers the repo from `git remote -v`. **Do not pass
`-R`** — that rule belongs to the parent `Capstone-LucenaPortal/` folder, which has no remote
to read. Only reach for `-R <owner>/<repo>` when you are deliberately filing against a
*different* repo in the org (schema work → `Capstone-LucenaPortal-DB`; a cross-repo decision →
`Central-System-Documents`).

The repo is **private**, so issue bodies are visible only to the org.

### Linking

- **Child → parent**: put the parent's key and memo ref on the first line of the body —
  `Parent: SCRUM-143 [S5-01]` — and in the title prefix (`[S5-01] …`) when it fits.
- **Parent → children**: GitHub issues are not mirrored into Jira automatically. When a set of
  children is cut, offer to comment their URLs on the Jira parent — it's a Jira write, so ask.

### Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`
- **Blocking edges**: declare them as GitHub blocking links, not as prose. A ticket whose
  blockers are all closed can be grabbed by any agent without reading the rest of the cohort.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

GitHub shares one number space across issues and PRs, so a bare `#42` may be either — resolve
with `gh pr view 42` and fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Decide what's being published first:

- **A new unit of planned work** (what `/to-spec` or a plan would produce) → Jira. That's a write
  to the shared board, so draft it and ask before creating.
- **Engineering children of an existing Jira ticket** (what `/to-tickets` produces) → GitHub
  issues here with `gh issue create`, each carrying its `Parent:` line.

## When a skill says "fetch the relevant ticket"

Route on what the user gave you. A `SCRUM-` key or a memo ref (`[S5-01]`) is Jira:
`getJiraIssue`, or `searchJiraIssuesUsingJql` on the summary when all you have is the ref. A
bare number (`12`) or a `#`-prefixed one is a GitHub issue: `gh issue view <number> --comments` —
then follow its `Parent:` line to Jira for the wider context.

## What stays on disk

Specs and wayfinder maps are not tickets. A spec is a living document edited over days; neither a
Jira description nor a GitHub issue body is a good home for one.

- `.scratch/<feature-slug>/spec.md` — the spec for a feature currently in flight.
- `.scratch/<effort>/map.md` — a `/wayfinder` map (see below).
- `src/portals/<portal>/docs/superpowers/{plans,specs,decisions}/` — durable, dated planning
  documents carried over from the archived Portal repos. They outlive the work; don't write
  tickets there.
- `src/portals/<portal>/docs/self-made/` — a Portal's hand-written PRD and account spec.
  Reference material, not a tracker.

## Wayfinding operations

Used by `/wayfinder`. The **map** stays local; its **child tickets** are GitHub issues.

- **Map**: `.scratch/<effort>/map.md` — the Notes / Decisions-so-far / Fog body, naming the Jira
  ticket the effort serves.
- **Child ticket**: a GitHub issue with a `Parent:` line. A `Type:` line in the body records the
  ticket type (`research`/`prototype`/`grilling`/`task`); the `claimed`/`resolved` state is the
  issue's open/closed state plus an assignee.
- **Blocking**: a GitHub blocking link. A ticket is unblocked when every blocker is closed.
- **Frontier**: `gh issue list --state open` filtered to unblocked and unassigned; lowest number wins.
- **Claim**: assign the issue to yourself before any work.
- **Resolve**: comment the answer, close the issue, then append a context pointer (gist + issue
  URL) to the map's Decisions-so-far in `map.md`.
