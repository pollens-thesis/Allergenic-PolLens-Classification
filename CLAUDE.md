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

## Current state (2026-10-14)

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
- **Google consent screen (2026-10-16):** published to *In production* (Cloud
  project `pollens-506806`, owner va.dmesa@gmail.com), named PolleRgies, with
  public `/privacy` and `/terms` pages (footer on every page and in Settings).
  Brand verification (logo) was rejected once as "home page not registered";
  retry **Verify branding** after 2026-10-17 (`docs/deployment.md`).
- **Roles, report verification and open sign-in (live 2026-10-18, issues
  #59/#60/#8/#9 closed, PRs #61 and #63):** Doc Fajardo wants the app open to
  everyone as a nationwide dataset, so reports from normal users are verified
  first. Anyone with a Google account or a Microsoft work/school account can sign
  in (`SIGNIN_ALLOW_ALL=true` on Render; unset or `false` falls back to the
  `SIGNIN_ALLOWED_DOMAINS`/`SIGNIN_ALLOWED_EMAILS` allowlist, which stays set as
  the rollback). Roles: admin (`is_superuser`; the emails are in the Render
  setting `ADMIN_EMAILS`, applied by `build.sh` on every deploy via
  `grant_admin --from-env`, add-only; admins can always sign in), verifier
  (approves or declines with a required reason) and user. Only `Verified` reports
  reach other people, the map, stats and exports, and only they feed classifier
  training; only admins (and the owner) see a researcher's name. The frontend has
  `/review` (verifiers, admins) and `/users` (admins; appoint verifiers, block
  accounts), a first version for Niño to refine. Smoke-tested live with a new
  gmail account (submit, stays private, admin approves, appears on the map). Dr. Fajardo
  (2026-10-19) is fine with verified reports being visible to every signed-in
  user and wants the researcher name kept from view, which it already is (owner
  and admins only). Still to review: the terms/privacy wording
  (`docs/system-spec.md`).
- **Workflow and board:** `CONTRIBUTING.md` is in use (first cycle: issue #1 →
  PR #2, the accented-name fix `5c23fd9`). The GitHub Projects board **"PolLens"
  exists** (org `pollens-thesis`, project number **1**, columns Backlog → Ready →
  In Progress (limit 2) → Review → Blocked → Done) with the labels `frontend`,
  `backend`, `devops`, `chore`, `blocked`, `adviser`. The open backlog is issues
  #6–#9 (`blocked` on the adviser), #11–#13, **#31** (classifier evaluation)
  and #44 (review workspace, PR #45); #42, #46 and #48 (Modal hosting, the
  `remote` backend, Roboflow removal) were finished by PRs #43, #47 and #51 and
  #53 (Allergen Reference names everywhere) is in PR #54 awaiting Niño's look;
  #4, #5, #16 and #21 (the
  ColorBrewer YlOrBr heatmap palette) were finished by PRs #19, #18, #17 and
  #22 (merged 2026-09-30), and #10 (go live with the detection model) by PRs
  #29 (Workflow mode), #30 (Render mock default off) and #32 (docs), merged
  2026-10-01 and closed by hand. Those merges did **not**
  auto-close their issues, so after a merge check the issue closed and run
  `gh issue close N --reason completed` if not (the board then moves it to
  Done). Agents move cards with `gh project item-edit` (needs the `project`
  scope — the owner's `gh` login has it; Niño's machine needs
  `gh auth refresh -h github.com -s project` once). Auto-add, item-closed and
  PR-merged rules are on. Past-work task list: the owner's local
  `PolLens-board` folder (not in the repo).
- **Detection model: live on Modal (2026-10-14, issues #42/#46, PRs #43/#47).**
  Production `/detect/` runs `DETECTION_BACKEND=remote`: the API posts each slide
  to `services/inference/` (FastAPI, hosted on Modal in workspace `ninoelma874`,
  scale-to-zero, memory snapshots, `region=ap-southeast`), which runs the YOLO26
  Detection v12 weights and the EfficientNet-B0 15-species classifier
  (`docs/inference-modal.md`). Render holds `INFERENCE_URL` and `INFERENCE_TOKEN`
  (the Modal secret `pollens-inference`); a cold start takes ~15 s, warm calls
  2–5 s. Verified 2026-10-14: Modal logged the site's `/detect` calls. The
  weights are private (Modal Volume `pollens-models`, local copies in
  `docs/private/finalized model/`). **Roboflow is retired and its code removed** (issue #48; the
  old Workflow is documented in `docs/roboflow-pipeline.md`, rollback means
  reverting that commit). The demo switch is now `DETECTION_MOCK` (was
  `ROBOFLOW_MOCK`).
  iPhone MPO photos are accepted as JPEG. Reports saved while mock was on keep a
  permanent Sample badge (delete and re-analyze them). **Still open (issue
  #31):** the constant-species problem was a Roboflow classifier trained on
  whole-slide photos; the replacement EfficientNet-B0 was trained on grain crops
  and is what runs now, but only within-slide accuracy exists, not an end-to-end
  evaluation on YOLO26 crops, and it covers 15 of the app's 23 species. Record
  metrics for the paper (adviser item 7 in `docs/system-spec.md`).
- **Next steps (written 2026-10-14):**
  1. Merge PR #52 (this file's update plus the Modal token-rotation procedure)
     and PR #54 (frontend, needs Niño's 👍; check it visually first: a report,
     the result workspace, the map popup, the inspector, a CSV export; confirm
     the odd labels "Rice pollen" and "Koroskorosan" in `DATASET_SPECIES_NAMES`).
  2. Evaluate the live classifier end to end on YOLO26 crops and record the
     metrics for the paper, then close #31 (only within-slide accuracy exists;
     15 of the 23 catalog species are covered).
  3. Niño: rename the leftover Roboflow names in the frontend (`fromRoboflow`,
     `RoboflowPrediction` in `lib/analysis.ts`, docs under `app/PolLens`).
  4. Decide the in-process `DETECTION_BACKEND=yolo26` path (kept, not deployed;
     `docs/yolo26-staging.md`) and the cold start (~15 s after 5 min idle;
     `docs/inference-modal.md`). Modal runs on Niño's free workspace
     (`ninoelma874`); the Modal secret was rotated 2026-10-14 and the procedure
     is in `docs/inference-modal.md`.
  5. Board hygiene: card #21 is still In Progress although its PR merged.
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
