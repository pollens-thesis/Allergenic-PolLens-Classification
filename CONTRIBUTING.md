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

## 1. Open an issue

Anything that takes more than ~30 minutes gets an issue. Tiny fixes (a typo,
a one-line tweak) can go straight to `master` without one.

- **Title:** what should be true when it's done — *"Weather select has a
  Not Recorded option"*, not *"weather"*.
- **Body:** why, what "done" looks like (a short checklist), and any links
  (`docs/system-spec.md` item, screenshot).
- **Assignee:** whoever will do it (unassigned = up for grabs).
- **Labels:**
  - area — `frontend`, `backend`, `devops`, `docs`
  - type — `feature`, `bug`, `chore`
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

- Work from an issue number when one exists; use the branch naming above.
- Put `Fixes #N` in the PR description (or the commit, if pushing directly).
- Don't create, close, or relabel issues unless asked.

---

## One-time board setup (project owner)

In the project (⋯ → **Workflows**), turn on: *Auto-add to project*
(`is:issue,pr`), *Item closed* → Done, *Pull request merged* → Done,
*Item reopened* → In Progress. Link the repo from the repo's **Projects** tab,
and create the labels above (repo → Issues → Labels).
