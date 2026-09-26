# PolLens thesis — agent guide (root)

This folder ties together a thesis project: **PolLens**, a research console
that identifies allergenic pollen in microscope slide images for the UPLB
allergen group (MSEUF–UPLB MOA). `CLAUDE.md` in this folder is the long-form
version of this guide; read it too — the rules are the same for every agent.

## Three repos, not one

| Path | Repo | Owner | What |
|---|---|---|---|
| `.` (root) | `0ban4/Allergenic-PolLens-Classification` | 0ban4 | docs + submodule pointers |
| `api/` | `0ban4/PolLens-Thesis` | 0ban4 (backend) | Django REST API — see `api/CLAUDE.md` |
| `app/PolLens/` | `ninoninonino19/PolLens` | ninoninonino19 (frontend) | Next.js app — **see `app/PolLens/AGENTS.md`** |

`api/` and `app/PolLens/` are **git submodules**: the root stores only which
commit of each to use.

- Change frontend code → commit and push **inside `app/PolLens/`**.
- Change backend code → commit and push **inside `api/`**.
- Change `docs/` or these guides → commit in the root.
- After pushing a submodule, bump the root pointer:
  `git add app/PolLens` (or `api`) → commit → push, **only after** the
  submodule commit is on its own remote (otherwise `git clone
  --recurse-submodules` breaks for everyone).

Clone everything with:

```bash
git clone --recurse-submodules https://github.com/0ban4/Allergenic-PolLens-Classification.git
```

## Source of truth

- **Implementation** (API contracts, data shapes, fields, flows): the frontend
  code in `app/PolLens/` is authoritative.
- **Scope, objectives, terminology:** the thesis paper
  (`docs/CCMS-CS-2026-008-PROPOSAL-MANUSCRIPT.pdf`) is authoritative.
- Conflicts and open adviser decisions live in `docs/system-spec.md` — add to
  it rather than guessing. Don't "correct" the frontend to match the paper.

## Secrets

Real configuration lives only in untracked files: `api/.env` and
`app/PolLens/.env.local` (each repo ignores them; `.env.example` shows the
keys). **Never commit `.env*`, `db.sqlite3`, `media/`, `venv/`,
`node_modules/`, `.next/`, `.vercel/` or `.claude/`.** Ask the project owner
for values privately.

## Hosting

- Frontend: Vercel (https://pollens-theta.vercel.app), deploying from
  `ninoninonino19/PolLens`.
- API: Render (https://pollens-api.onrender.com; free tier sleeps when idle),
  database on Neon, slide images in Cloudflare R2. See `docs/deployment.md`.
