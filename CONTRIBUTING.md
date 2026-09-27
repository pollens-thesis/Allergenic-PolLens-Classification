# How we work — GitHub + the PolLens board

This is how the team uses GitHub so the **PolLens Scrumban board**
(GitHub Projects, `pollens-thesis` org) stays up to date by itself. It applies
to people and to coding agents (Claude, Codex) alike.

The one rule behind everything: **work starts as an issue and ends with a
commit or PR that closes it.** The board only sees issues and pull requests —
it can't see plain commits.

---

## The board

| Column | Means | Who moves it |
|---|---|---|
| **Backlog** | Wanted, not planned yet | Auto (new issues land here) |
| **Ready** | Clear enough to start; next up | You, in the weekly check-in |
| **In Progress** | Someone is working on it — **max 2 per person** | You, when you start |
| **Review** | PR open, waiting for a look / preview check | Auto-ish: move it when you open the PR |
| **Blocked** | Waiting on someone else (adviser, UPLB data, the other side) | You — and say why in a comment |
| **Done** | Merged / closed | Auto (issue closed or PR merged) |

- **WIP limit:** don't start a third card; finish or unblock one first.
- **Pull, don't push:** take the top card from Ready when you have room.
- **Weekly check-in** (~15 min): refill Ready, sort Blocked, close stale cards.

---

## Our routine (Van & Niño)

Van owns the backend (`api/`), hosting and the board; Niño owns the frontend
(`app/PolLens/`). Each of you only moves **your own** cards.

**Weekly check-in — Mondays, ~15 min, together (call or chat):**
1. Look at **Done** since last week (what shipped — useful for thesis logs).
2. **Blocked:** anything unblocked? Anything to raise with the adviser
   (filter the board by label `adviser`)?
3. **Refill Ready:** drag the next 2–4 cards each into Ready, top = most
   important, and assign them.
4. Agree anything cross-side (below) so neither of you waits.

**Each working session:**
1. `git pull` on `master`.
2. Take the top card of **Ready** assigned to you → **In Progress** (never more
   than 2). With Claude/Codex, just say *"work on #12"* — the agent does the
   board moves (see *For coding agents*).
3. Work on a branch, commit with `(#12)`.
4. Open a PR with `Fixes #12` → card to **Review**; check the Vercel preview.
5. Merge → the card goes to **Done** by itself, and the site deploys.
6. Found a new bug or follow-up? Open an issue (it lands in Backlog) rather
   than widening the current one.

**Cross-side work** (frontend needs something from the API, or the reverse):
open an issue for the other side, assign it to them, label it `backend` /
`frontend`, and in your own issue write *"Blocked by #15"* and move yours to
**Blocked**. The backend change is merged and deployed **first**.

**Reviews:** a PR that changes the API contract, shared docs or the other
person's folder waits for the other's 👍 (a comment is enough). Own-side PRs
can be merged by the author after the preview check.

**Stuck on the adviser or UPLB:** label `blocked` + `adviser`, move to
**Blocked**, comment what's needed. Bring it to the next adviser meeting.

---

## 1. Open an issue

Anything that takes more than ~30 minutes gets an issue. Tiny fixes (a typo,
a one-line tweak) can go straight to `master` without one.

- **Title:** what should be true when it's done — *"Weather select has a
  Not Recorded option"*, not *"weather"*.
- **Body:** why, what "done" looks like (a short checklist), and any links
  (`docs/system-spec.md` item, screenshot).
- **Assignee:** whoever will do it (unassigned = up for grabs).
- **Labels:**
  - area — `frontend`, `backend`, `devops`, `documentation`
  - type — `enhancement` (feature), `bug`, `chore`
  - `blocked` when it's waiting on someone (also move it to Blocked)
  - `adviser` when it needs an adviser decision
- It appears in **Backlog** automatically.

Bugs: say what you did, what happened, what you expected, and where
(local / live site, browser, page).

---

## 2. Start work

Move the card to **In Progress**, then branch from an up-to-date `master`,
putting the issue number in the name:

```bash
git checkout master
git pull
git checkout -b feat/12-weather-not-recorded     # fix/..., chore/..., docs/...
```

---

## 3. Commit

- Imperative, specific messages: *"Add a Not Recorded option to the weather
  select"*.
- Mention the issue so it links on GitHub: *"… (#12)"*.
- Keep **frontend (`app/PolLens/`) and backend (`api/`) changes in separate
  commits**.
- Before committing: `git status` — **never** `.env*`, `db.sqlite3`, `media/`,
  `docs/private/` (the repo is public).
- Frontend checks before pushing (in `app/PolLens/`): `npx tsc --noEmit`,
  `npm run lint`, `npm run build`. Backend: `python manage.py test` (in `api/`).

---

## 4. Open a pull request

```bash
git push -u origin feat/12-weather-not-recorded
```

Then on GitHub → **Compare & pull request** into `master`:

- In the PR description write **`Fixes #12`** (or `Closes #12`). This is what
  closes the issue and moves the card to **Done** when the PR is merged.
  Several issues: `Fixes #12, fixes #14`.
- Move the card to **Review**.
- Vercel comments a **preview link** — check the changed pages there
  (desktop and ~390px wide). *(Signing in on previews needs the preview origin
  allowed; if it isn't, check locally.)*
- Ask the other person to look if it touches their side or the API contract.
  Small, own-side changes can be merged by the author.

## 5. Merge

- **Squash and merge** (one clean commit on `master`), then delete the branch.
- A merge to `master` **deploys the live site** (Vercel frontend, Render API).
  Backend changes the frontend depends on go in first.
- The issue closes and the card moves to **Done** automatically.

Pushing straight to `master` is fine for tiny fixes — put `Fixes #12` in the
commit message and the issue still closes.

---

## Blocked and adviser items

- Blocked card: add the `blocked` label, move it to **Blocked**, and comment
  who/what it's waiting on. Move it back to Ready when unblocked.
- Adviser decisions stay listed in `docs/system-spec.md`; open an issue (label
  `adviser`) only when there's real work to do once the decision is made.

## For coding agents (Claude, Codex)

Agents keep the board current **without being asked**, using the `gh` CLI as
the signed-in person. Board: org `pollens-thesis`, project **"PolLens"**,
number **1** (below it's `$P`, so `P=1`); repo
`pollens-thesis/Allergenic-PolLens-Classification`. Set a card's status by name
(tested):
`gh project item-edit 1 --owner pollens-thesis --url <issue-or-PR-url> --field Status --value "Review"`
(values: Backlog, Ready, In Progress, Review, Blocked, Done).

**At the start of a task:**
1. Find the issue: the number the person gave, or
   `gh issue list --search "<keywords>" --state open`.
2. No issue and the task is more than a tiny fix → create one and tell the
   person its number:
   `gh issue create --title "..." --body "Why / Done when: ..." --label frontend --label enhancement --assignee @me`
   (it is auto-added to Backlog).
3. WIP check: `gh project item-list $P --owner pollens-thesis --format json`
   — if the person already has 2 items **In Progress**, say so and ask which
   to park before starting a third.
4. Move it: `gh issue edit N --add-assignee @me` and
   `gh project item-edit $P --owner pollens-thesis --url <issue-url> --field Status --value "In Progress"`
   (if the issue isn't on the board yet: `gh project item-add $P --owner pollens-thesis --url <issue-url>` first).
5. Branch `feat/N-short-name` (or `fix/`, `chore/`, `docs/`) from `master`.

**While working:** commit messages end with `(#N)`; frontend and backend in
separate commits. A new, separate problem found along the way → a new issue
(Backlog), listed in the final report — don't widen the current one.

**At the end:**
1. Push the branch and open a PR:
   `gh pr create --base master --title "..." --body "Fixes #N" + a short summary and how it was verified`.
2. Move the card to **Review** (same `item-edit` command, `--value "Review"`).
3. Report the issue and PR links. **Don't merge** unless the person says so;
   when they do: `gh pr merge --squash --delete-branch` (the card goes to Done
   by itself). If the person asked for a direct push to `master` instead, put
   `Fixes #N` in the commit message.

**Blocked:** `gh issue edit N --add-label blocked`, Status `Blocked`, and
`gh issue comment N --body "Blocked by #M / waiting on ..."`.

**Limits:** only move, edit or close issues assigned to the person you're
working for (commenting on others' is fine). Never delete issues, labels or
board items. If `gh` says the token lacks the `project` scope, ask the person
to run `gh auth refresh -s project` (for Claude Code: `! gh auth refresh -s project`)
and carry on with the issue/PR steps meanwhile — merging still moves the card
to Done automatically.

---

## One-time board setup (project owner)

In the project (⋯ → **Workflows**), turn on: *Auto-add to project*
(`is:issue,pr`), *Item closed* → Done, *Pull request merged* → Done,
*Item reopened* → In Progress. Link the repo from the repo's **Projects** tab.
Create the missing labels once:

```bash
R=pollens-thesis/Allergenic-PolLens-Classification
gh label create frontend -R $R --color 1d76db --description "app/PolLens"
gh label create backend  -R $R --color 5319e7 --description "api"
gh label create devops   -R $R --color 0e8a16 --description "Hosting, CI, repo"
gh label create chore    -R $R --color c5def5 --description "Maintenance"
gh label create blocked  -R $R --color b60205 --description "Waiting on someone"
gh label create adviser  -R $R --color fbca04 --description "Needs an adviser decision"
```

Each person (and each machine an agent runs on) needs `gh` signed in with
project access once: `gh auth login`, then `gh auth refresh -s project`.
