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
