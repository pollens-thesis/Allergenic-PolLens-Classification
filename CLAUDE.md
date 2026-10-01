# Thesis Project — PolLens

This root directory contains two related but separately-developed parts:

- `app/PolLens/` — the frontend (Next.js). Has its own CLAUDE.md with its
  own conventions. Do not modify frontend code from backend sessions unless
  explicitly asked. See the narrow exception below for wiring real backend
  endpoints into existing mocks.
- `api/` — the backend, currently being developed. See `api/CLAUDE.md` for
  backend-specific conventions.
- `docs/` — shared documentation, including the paper-vs-frontend
  reconciliation (see below).

## Git Repository Structure

Since 2026-09-26 the whole project is **one repository** (a monorepo):
`pollens-thesis/Allergenic-PolLens-Classification` on GitHub, owned by the `pollens-thesis` organization, public,
default branch `master`. `api/` and `app/PolLens/` are ordinary folders —
**not submodules** — so a change anywhere is one commit and one push, with no
pointer "bumps". Their full histories were merged in when the repo was
unified; the old repos (`0ban4/PolLens-Thesis`, `ninoninonino19/PolLens`) are
archived, read-only.

```
git clone https://github.com/pollens-thesis/Allergenic-PolLens-Classification.git
```

- Backend code → `api/`; frontend code → `app/PolLens/`; docs → `docs/`.
  Commit and push from anywhere in the repo.
- Day-to-day workflow (issues → branch → PR with `Fixes #N` → the Scrumban
  board in GitHub Projects) is in `CONTRIBUTING.md`.
- **Board automation — do this without being asked:** for any task beyond a
  tiny fix, follow `CONTRIBUTING.md` → *For coding agents*: find or create the
  issue, move its card to In Progress (respect the 2-per-person limit), branch
  `feat/N-…`, commit with `(#N)`, open a PR with `Fixes #N`, move the card to
  Review, and report the links. Merge only when the user says so.
- Keep backend and frontend changes in separate commits (see the exception
  below), so each side's history stays readable.
- **The repo is public.** Never commit secrets: `api/.env`,
  `app/PolLens/.env.local`, `db.sqlite3`, `media/`, `venv/`, `node_modules/`,
  `.next/`, `.vercel/` are gitignored. Private project documents (the thesis
  proposal PDF, letters, screenshots) live in the gitignored `docs/private/`
  and are shared privately, never committed.
- Deploys: Render builds the API from `api/` (Root Directory `api`); Vercel
  builds the frontend from `app/PolLens/` (Root Directory `app/PolLens`). A
  push to `master` redeploys both. See `docs/deployment.md`.

## Current state (2026-10-01)

- **Live and verified:** frontend https://pollens-theta.vercel.app, API
  https://pollens-api.onrender.com (`/healthz/` ok). Render and Vercel were
  re-pointed to this monorepo on 2026-09-26 (Root Directories `api` and
  `app/PolLens`); a push to `master` deploys both.
- **Who owns what:** backend (`api/`) — 0ban4; frontend (`app/PolLens/`) —
  ninoninonino19 (handed over 2026-09-26, `pollens-thesis` org owner). The old
  repos are archived. `pollens-thesis/Allergenic-PolLens-Classification-archive`
  (the pre-unification root, which still contains the private documents in old
  branches) **must stay private**.
- **Open work:** the adviser/team list in `docs/system-spec.md` (Audit section)
  and the frontend open tasks in `app/PolLens/AGENTS.md`.
- **Planned, not built:** opening sign-in to any Google account (adviser item
  12 in `docs/system-spec.md`). Today only the allowlist signs in
  (`up.edu.ph`, `mseuf.edu.ph` + `SIGNIN_ALLOWED_EMAILS`).
- **Workflow and board:** `CONTRIBUTING.md` is in use (first cycle: issue #1 →
  PR #2, the accented-name fix `5c23fd9`). The GitHub Projects board **"PolLens"
  exists** (org `pollens-thesis`, project number **1**, columns Backlog → Ready →
  In Progress (limit 2) → Review → Blocked → Done) with the labels `frontend`,
  `backend`, `devops`, `chore`, `blocked`, `adviser`. The open backlog is issues
  #6–#13 (most are `blocked` on the adviser); #4, #5, #16 and #21 (the
  ColorBrewer YlOrBr heatmap palette) were finished by PRs #19, #18, #17 and
  #22 (merged 2026-09-30). Those merges did **not**
  auto-close their issues, so after a merge check the issue closed and run
  `gh issue close N --reason completed` if not (the board then moves it to
  Done). Agents move cards with `gh project item-edit` (needs the `project`
  scope — the owner's `gh` login has it; Niño's machine needs
  `gh auth refresh -h github.com -s project` once). Auto-add, item-closed and
  PR-merged rules are on. Past-work task list: the owner's local
  `PolLens-board` folder (not in the repo).
- **Detection model: live (2026-10-01, issue #10, PRs #29/#30).** Production runs
  a two-stage Roboflow Workflow, not mock: YOLOv11 (nano) finds grains as one
  `pollen` class, Dynamic Crop, ResNet-34 names the species (Roboflow workspace
  `nino-elma`, workflow `detect-classify-v1`). `/detect/` calls it when
  `ROBOFLOW_WORKFLOW_ID` is set; runbook and Workflow JSON are in
  `docs/roboflow-pipeline.md`. iPhone MPO photos are accepted as JPEG. Reports
  saved while mock was on keep a permanent Sample badge (delete and re-analyze
  them). **Known problem — next focus (issue #31):** the classifier returns the
  same species (`Sorghum halepense`) for every grain, most likely because it was
  trained on whole-slide photos rather than grain crops; rebuild the
  classification set from crops and retrain, then record metrics for the paper
  (adviser item 7 in `docs/system-spec.md`).
- **Teammate:** Niño runs the project locally and signs in. If sign-in fails
  for someone new, see the Troubleshooting table in `docs/deployment.md`
  (Google "Access blocked" = add them as a test user).

## Source of Truth: Paper vs. Frontend

- The thesis proposal (`docs/private/CCMS-CS-2026-008-PROPOSAL-MANUSCRIPT.pdf`,
  kept out of the public repo; ask the team for it) — the original thesis proposal. Written before
  development began; NOT updated to reflect later revisions.
- `app/PolLens/` — the actual, current frontend implementation. Has been
  revised since the paper was written (adviser consultation changes),
  and those revisions are not reflected in the paper.

**Precedence rule:**
- For **implementation details** (API contracts, data shapes, field names,
  user flows) → the **frontend code (`app/PolLens/`) is authoritative**.
- For **scope, objectives, and terminology** → the **paper is authoritative**.
- Unresolved conflicts should be flagged, not guessed at, and added to
  `docs/system-spec.md`.

Do not "correct" the frontend to match the paper. The paper is the outdated
document, not the frontend.

See `docs/system-spec.md` for the full reconciliation table (generated via
the process in `docs/reconciliation-plan.md`).

## Exception: Frontend Integration-Point Edits

Backend sessions may edit the frontend ONLY to replace a mocked
integration point with a real call to a backend endpoint that has just
been built and verified — e.g. swapping lib/account.ts's mocked "Continue
with Google" flow for a real Google Identity Services call once
/api/v1/auth/google/ exists.

This does NOT extend to: general frontend work, styling, new features, or
any change not directly wiring an existing mock to an existing backend
endpoint.

Rules for these edits:
- Follow app/PolLens/'s own CLAUDE.md/AGENTS.md conventions, not backend
  conventions.
- Make the change in its own commit, separate from any backend commits in
  the same session, with a clear message (e.g. "wire real Google OAuth
  into lib/account.ts — was mocked").
- Note the change in docs/system-spec.md's Decision/Notes for that
  feature, so it's visible there rather than only in git history.
- If uncertain whether an edit falls inside this scope, stop and ask
  rather than proceeding.
