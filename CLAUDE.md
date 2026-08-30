# Backend — PolLens API

This is the backend for the PolLens thesis system, built against the
frontend in `../app/PolLens/`.

Before implementing any feature, consult `../docs/system-spec.md` for
what the frontend actually expects — do not implement based on the paper
alone. See the root CLAUDE.md (`../CLAUDE.md`) for the full precedence rule
between the thesis proposal paper and the frontend.

## Stack / Conventions

- **Language/Framework:** Python, Django + Django REST Framework (DRF)
- **Database:** PostgreSQL
- **Auth:** Login is via Google OAuth — the frontend sends a Google ID
  token, the backend verifies it (audience/signature/expiry) and, on
  success, exchanges it for our own JWT pair via
  `djangorestframework-simplejwt` (access + refresh tokens). There is no
  username/password login endpoint. Real login is
  `POST /api/v1/auth/google/` (`accounts.views.GoogleLoginView`), built
  against the `google-auth` package (`google.oauth2.id_token.verify_oauth2_token`)
  and the `GOOGLE_OAUTH_CLIENT_ID` env var. `TokenObtainPairView` in
  `config/urls.py` is only a scaffolding placeholder still left wired up
  at `/api/v1/auth/token/` — do not build against it; `TokenRefreshView`
  still applies as-is for refreshing a pair issued by `GoogleLoginView`.
  JWT (rather than session/cookie auth) was chosen because the frontend
  (`app/PolLens/`, Next.js) is a separate app from a different origin —
  session/cookie auth would add unnecessary CSRF complexity for a
  decoupled setup like this.
  - **User identity:** custom `accounts.User` model
    (`AUTH_USER_MODEL = 'accounts.User'`), keyed on unique `email` with no
    usable password — there's no separate profile/name field, matching
    `app/PolLens/lib/account.ts`'s "the signed-in address is the only
    thing stored" design. `institution` mirrors the Google ID token's
    `hd` (hosted domain) claim when present, refreshed on every login.
    The paper's `role` field was deliberately not added — the frontend
    has no consumer for it (see the Google OAuth row in
    `../docs/system-spec.md`); add it only if that's revisited.
  - The request-body key (`id_token`) and response shape
    (`{ "access": ..., "refresh": ... }`, matching
    `TokenObtainPairView`'s output) are now frontend-confirmed: as of
    2026-08-27, `app/PolLens/components/SignInForm.tsx` renders Google's
    real account-chooser button via Google Identity Services, and
    `app/PolLens/lib/auth.ts` POSTs GIS's `credential` to this endpoint
    under the `id_token` key and reads back exactly `{ access, refresh }`.
    Don't rename either without checking `lib/auth.ts` first.
  - **`POST /api/v1/auth/logout/`** (`accounts.views.LogoutView`,
    `IsAuthenticated`): body `{ "refresh": "<token>" }`; blacklists that
    refresh token via `rest_framework_simplejwt.token_blacklist` (now
    installed — `ROTATE_REFRESH_TOKENS`/`BLACKLIST_AFTER_ROTATION` in
    `SIMPLE_JWT` actually take effect as of this endpoint). Success:
    `200 { "detail": "Successfully logged out." }`. Missing `refresh`:
    `400 { "detail": "A refresh token is required." }`. Invalid/expired/
    already-blacklisted token: `401 { "detail": "Invalid or expired
    refresh token." }`. Not `TokenBlacklistView` from
    `rest_framework_simplejwt` — that view is unauthenticated by default
    and its response shapes don't match this project's `{"detail": ...}`
    convention, so a small custom view was written instead.
  - **`GET /api/v1/auth/me/`** (`accounts.views.MeView`,
    `IsAuthenticated`): no body. Returns `{ "email": "...", "institution":
    "..." }` for the signed-in user (`institution` is `""` when the
    Google account has no `hd` claim). No caller in the frontend yet — see
    the Google OAuth row in `../docs/system-spec.md`.
  - **Test coverage**: `accounts/tests.py` covers `GoogleLoginView`,
    `LogoutView`, and `MeView` (success/failure paths, plus the
    logout-blacklists-a-real-token-and-`/token/refresh/`-then-rejects-it
    round trip). Run with `python manage.py test accounts`. Extend this
    file rather than starting a new one when adding more `accounts`
    endpoints.
  - **What's still open on login/session** (2026-08-30): the backend side
    of Google OAuth — handshake, logout, `/me/`, token blacklist — is
    fully built and tested. What remains (route guarding, attaching the
    access token to requests, refresh/401 handling, wiring "Sign out" to
    call `/logout/`) is frontend work outside this file's scope; see
    `../docs/login-frontend-handoff.md` for the full handoff instead of
    re-deriving it from scratch.
- **Reports:** server-side storage for saved analysis batches — the
  backend replacement for `app/PolLens/lib/store.ts`'s IndexedDB
  persistence. **This app is storage only** — no server-side ML/Roboflow
  inference and no async processing pipeline. `POST` is fully synchronous
  and always writes `status="Completed"`.
  - **Visibility:** shared corpus — every authenticated user can list/view
    every report (`GET` endpoints have no owner filter). `Report.owner`
    (FK → `accounts.User`, nullable) is captured for attribution and
    future edit/delete permission checks only, and is never present in
    API responses.
  - **`GET /api/v1/reports/`** (`reports.views.ReportListCreateView`,
    `IsAuthenticated`): returns a plain JSON array of every report (no
    pagination), each shaped exactly like `Specimen` in
    `app/PolLens/lib/data.ts`.
  - **`POST /api/v1/reports/`** (same view): multipart body —
    `collectedAt`/`location`/`researcher` as plain form fields, `weather`
    and `slides` as JSON-encoded strings in form fields (mirroring
    `NewReportInput`/`WeatherConditions` shapes, camelCase keys), and one
    file part per slide keyed by its index as a string (`"0"`, `"1"`, ...)
    — matches `saveReport(input, images)`'s `images: Record<string, Blob>`
    convention in `lib/store.ts`. Missing image for a described slide →
    `400`. Returns `201` with the full created report, including a
    server-assigned `sampleId` (`PLN-<year>-NNNN`, sequential per calendar
    year via `reports.models.next_sample_id()`, row-locked for
    concurrency-safety — a deliberate deviation from the frontend mock's
    non-resetting global counter).
  - **`GET /api/v1/reports/<sample_id>/`** (`reports.views.ReportDetailView`,
    `IsAuthenticated`): single report by `sampleId`. `404 {"detail": "Report
    not found."}` if missing.
  - **Models** (`reports/models.py`): `Report` (weather flattened onto the
    model as nullable fields, not a separate table; `collected_at` stored
    as a validated `CharField`, not `DateTimeField`, to preserve the
    frontend's opaque ISO-date-or-datetime string exactly), `Slide` (one
    `ImageField` per slide, served via `MEDIA_URL`/`MEDIA_ROOT` — local
    disk in dev, guarded by `DEBUG` in `config/urls.py`; no production
    media storage, e.g. S3, configured yet), `Detection` (per-species
    summary row), `Grain` (optional per-grain bounding box — a slide may
    have zero). `species_id` choices match `SpeciesId` in `lib/data.ts`
    exactly (8 values); `status` choices include `Processing`/`Needs
    review` for schema completeness even though nothing writes them yet.
  - **Test coverage**: `reports/tests.py` covers both views —
    authentication, list (empty/populated), create (multipart success,
    missing weather, missing image, invalid species, empty slides,
    sequential sample-id increments), and detail (found/404). Run with
    `python manage.py test reports`.
  - **What's still open**: no `PATCH`/`DELETE` (owner is captured for this,
    unused so far); no filtering/search on the list endpoint (the paper's
    Report Listing & Filtering feature — see `../docs/system-spec.md`);
    no monthly-aggregation endpoint for the dashboard's historical pollen
    chart (separate feature); not yet wired into the frontend —
    `lib/store.ts` still persists to IndexedDB, per the root `CLAUDE.md`'s
    narrow frontend-integration exception (wire only once verified, as
    its own commit).
- **API style:** REST, DRF ViewSets/Serializers unless a specific endpoint
  needs something custom.
- **Folder structure:** Django project scaffolded at `api/` with settings
  module `config/` (`config/settings.py`, `config/urls.py`). One domain
  app per module — `accounts` (user identity/auth) and `reports` (report
  storage) exist; others (e.g. `samples`, if a separate module is still
  needed) aren't yet created. Add new ones with
  `python manage.py startapp <name>` when a module's scope is decided,
  and register each in `INSTALLED_APPS`. Within an app, auth/permission
  logic lives in `views.py` + `serializers.py` (see `accounts/` — no
  separate `permissions.py`/`services.py` split yet; introduce one only
  once an app's `views.py` actually gets unwieldy).
- **API response format:** no envelope — success responses are the raw
  serializer `.data` (a single object, or a plain array for list
  endpoints; no pagination wrapper). Errors are `{"detail": "..."}` for
  simple cases; `reports`' `POST /api/v1/reports/` additionally includes a
  structured `errors` field (`{"detail": "...", "errors": {...}}`) on
  validation failures, since that payload is deeply nested
  (report → slides → detections/grains) and a bare message isn't
  debuggable enough for a client building against it. Established by
  `accounts`, continued by `reports` — treat as the convention for new
  endpoints unless there's a specific reason to deviate.
- **Error handling conventions:** manual `Response({'detail': ...},
  status=...)` (or the `errors`-augmented form above) per branch in each
  view — no custom DRF exception handler or exception classes. Keeps every
  error shape explicit and visible at the call site.
- **Endpoint naming:** `/api/v1/<module>/<resource>/`, trailing slash,
  routes registered directly in `config/urls.py`'s flat list (no per-app
  `urls.py`/`include()` yet — introduce one only if that list gets
  unwieldy).

## Workflow notes

- Reference `../docs/system-spec.md` before building any module tied to a
  feature that differs between the paper and frontend.
- If `../app/PolLens/` changes significantly after `system-spec.md` was
  generated, re-run the reconciliation (see `../docs/reconciliation-plan.md`)
  before continuing — otherwise the spec will be stale.
- For the login/session feature specifically, `../docs/login-frontend-handoff.md`
  is the up-to-date handoff of what's built vs. what's still needed on the
  frontend — check it before assuming more backend work is needed there.
