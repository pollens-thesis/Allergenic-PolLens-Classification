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

```bash
git clone https://github.com/pollens-thesis/Allergenic-PolLens-Classification.git
```

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
