# Reconciliation Plan: Thesis Paper vs. Frontend

Purpose: produce `system-spec.md`, the actual working spec for backend
development, by comparing the original thesis proposal against what the
frontend (`app/PolLens/`) actually implements.

Run this from `D:\Thesis` in Claude Code. Run each phase in a **separate,
isolated context** (new session or `/clear` between phases) so one
extraction doesn't bias the other.

## Phase 1 — Paper-only extraction

Prompt:

> Read `docs/CCMS-CS-2026-008-PROPOSAL-MANUSCRIPT.pdf` only. Do not look at or reference any
> frontend or backend code in this repo.
>
> Extract every planned feature/module described in the paper. Output a
> markdown table with columns: Module | Feature | Description | Implied
> Data Entities / Endpoints.
>
> Save the result to `docs/paper-features.md` and nothing else.

Then clear context.

## Phase 2 — Frontend-only extraction

Prompt:

> Explore `app/PolLens/` only. Do not read `docs/CCMS-CS-2026-008-PROPOSAL-MANUSCRIPT.pdf` or
> `docs/paper-features.md`.
>
> List every implemented feature, page, and component. For each, note:
> form fields/inputs, state being managed, and any API/fetch calls or
> backend data it expects.
>
> Output a markdown table with columns: Module | Feature/Component |
> Description | Expected API Calls or Data.
>
> Save the result to `docs/frontend-features.md` and nothing else.

If `app/PolLens/` is large, consider delegating this phase to a read-only
subagent to avoid burning main session context.

Then clear context.

## Phase 3 — Reconciliation

Prompt:

> Read `docs/paper-features.md` and `docs/frontend-features.md`.
>
> For each paper feature, find its corresponding frontend implementation
> (if any) and classify it as: Unchanged, Revised, Added (not in paper),
> or Removed (in paper but not implemented).
>
> Output a table: Paper Feature | Frontend Status | What Changed |
> Backend Impact.
>
> Save the result to `docs/system-spec.md`.

## After Phase 3

- Manually spot-check `system-spec.md` — Claude Code can miscategorize a
  feature as "removed" when it was actually just renamed or restructured
  into multiple components. A ~10 minute human read-through here prevents
  building backend modules against a bad diff.
- `system-spec.md` is a point-in-time snapshot, not a live link. If the
  frontend changes materially later, re-run Phases 2 and 3.
