# PolLens thesis — agent guide (root)

This folder ties together a thesis project: **PolLens**, a research console
that identifies allergenic pollen in microscope slide images for the UPLB
allergen group (MSEUF–UPLB MOA). `CLAUDE.md` in this folder is the long-form
version of this guide; read it too — the rules are the same for every agent.

## One repository

Everything is in **one repo**: `pollens-thesis/Allergenic-PolLens-Classification` (GitHub organization
`pollens-thesis`, public, branch `master`).

| Folder | What | Guide |
|---|---|---|
| `api/` | Django REST API (backend) | `api/CLAUDE.md` |
| `app/PolLens/` | Next.js app (frontend) | **`app/PolLens/AGENTS.md`** |
| `docs/` | Shared docs: system spec, deployment, paper features | — |

`api/` and `app/PolLens/` are plain folders (not submodules). Commit and push
from anywhere — there is nothing to "bump". Keep backend and frontend changes
in separate commits.

**Workflow:** issues, branches, PRs and the Scrumban board — see
`CONTRIBUTING.md` (put `Fixes #N` in the PR so the board updates).
Agents: do the board steps in `CONTRIBUTING.md` → *For coding agents*
automatically (issue → In Progress → PR `Fixes #N` → Review), without being asked.

```bash
git clone https://github.com/pollens-thesis/Allergenic-PolLens-Classification.git
```

## Current state (2026-09-26)

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
  `backend`, `devops`, `chore`, `blocked`, `adviser`. The backlog is issues
  #3–#13; agents move cards with `gh project item-edit` (needs the `project`
  scope — the owner's `gh` login has it; Niño's machine needs
  `gh auth refresh -h github.com -s project` once). Auto-add, item-closed and
  PR-merged rules are on. Past-work task list: the owner's local
  `PolLens-board` folder (not in the repo).
- **Teammate:** Niño runs the project locally and signs in. If sign-in fails
  for someone new, see the Troubleshooting table in `docs/deployment.md`
  (Google "Access blocked" = add them as a test user).

## Source of truth

- **Implementation** (API contracts, data shapes, fields, flows): the frontend
  code in `app/PolLens/` is authoritative.
- **Scope, objectives, terminology:** the thesis paper
  (kept privately in `docs/private/`, not in the public repo) is authoritative.
- Conflicts and open adviser decisions live in `docs/system-spec.md` — add to
  it rather than guessing. Don't "correct" the frontend to match the paper.

## Secrets

**This repo is public.** Real configuration lives only in untracked files:
`api/.env` and `app/PolLens/.env.local` (`.env.example` shows the keys).
**Never commit `.env*`, `db.sqlite3`, `media/`, `venv/`, `node_modules/`,
`.next/`, `.vercel/`, `.claude/` or anything in `docs/private/`.** Ask the
team for values privately.

## Hosting

- Frontend: Vercel (https://pollens-theta.vercel.app), built from
  `app/PolLens/` of this repo (Root Directory `app/PolLens`).
- API: Render (https://pollens-api.onrender.com; free tier sleeps when idle),
  built from `api/` (Root Directory `api`); database on Neon, slide images in
  Cloudflare R2. See `docs/deployment.md`.
- A push to `master` redeploys both.
