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

As of 2026-08-31, `D:\Thesis` itself is a git repo
(`0ban4/Allergenic-PolLens-Classification` on GitHub), and `app/PolLens/`
and `api/` are each **separate git repos wired in as submodules** — not
plain subfolders. Each keeps its own independent history and remote:

| Path | Repo | Owner |
|---|---|---|
| `D:\Thesis` (root) | `0ban4/Allergenic-PolLens-Classification` | this project (ties everything together) |
| `api/` | `0ban4/PolLens-Thesis` | backend (this account) |
| `app/PolLens/` | `ninoninonino19/PolLens` | frontend dev |

**Which folder to `cd` into depends on what you're changing:**
- Backend code → `api/`, commit/push there.
- Frontend code → `app/PolLens/`, commit/push there.
- `docs/` or this root `CLAUDE.md` → the root (`D:\Thesis`), commit/push there.

**The submodule gotcha:** the root repo doesn't store `api/`'s or
`app/PolLens/`'s files — only a pointer (gitlink) to *which commit* of
each to use. After committing and pushing inside `api/` or `app/PolLens/`,
the root repo will show that path as "modified" until the pointer is also
bumped there:

```
cd api  (or app/PolLens)
git add -A && git commit -m "..." && git push        # commit+push inside the submodule first
cd ..   (back to root)
git add api                                            # (or app/PolLens)
git commit -m "Bump api submodule to ..." && git push  # then bump the pointer
```

**Push submodule commits before bumping the root pointer.** A root commit
that points at a submodule commit which was never pushed to that
submodule's own remote will break `git clone --recurse-submodules` for
anyone else — this happened once already (a local-only `app/PolLens`
commit got pointed to from root before being pushed to
`ninoninonino19/PolLens`) and was caught by manually test-cloning the
root repo fresh. When in doubt, test-clone `git clone --recurse-submodules
<root-repo-url>` into a scratch directory to confirm both submodules
resolve.

## Source of Truth: Paper vs. Frontend

- `docs/CCMS-CS-2026-008-PROPOSAL-MANUSCRIPT.pdf` — the original thesis proposal. Written before
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
- **Push the commit to `app/PolLens/`'s own remote** (`ninoninonino19/PolLens`)
  before bumping the root repo's submodule pointer — see Git Repository
  Structure above. A root commit pointing at an unpushed `app/PolLens/`
  commit breaks `git clone --recurse-submodules` for anyone else.
- Note the change in docs/system-spec.md's Decision/Notes for that
  feature, so it's visible there rather than only in git history.
- If uncertain whether an edit falls inside this scope, stop and ask
  rather than proceeding.
