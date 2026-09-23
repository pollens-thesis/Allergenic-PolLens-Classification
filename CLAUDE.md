# Backend — PolLens API

This is the backend for the PolLens thesis system, built against the
frontend in `../app/PolLens/`.

Before implementing any feature, consult `../docs/system-spec.md` for
what the frontend actually expects — do not implement based on the paper
alone. See the root CLAUDE.md (`../CLAUDE.md`) for the full precedence rule
between the thesis proposal paper and the frontend.

## Stack / Conventions

- **Language/Framework:** Python, Django + Django REST Framework (DRF)
- **Database:** PostgreSQL. Hosted on Neon as of 2026-08-31 (`config/settings.py`'s
  Postgres branch sets `sslmode=require` via `DATABASE_SSLMODE`, default
  `require`, plus `CONN_MAX_AGE=600` for connection reuse over the
  network). Local dev still falls back to SQLite with `DATABASE_NAME`
  unset; see `.env.example`.
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
    `app/PolLens/lib/data.ts`. Supports optional query params matching the
    filter set `app/PolLens/components/ReportsTable.tsx` already
    implements client-side (added 2026-08-31, not yet wired to the
    frontend): `q` (case-insensitive substring match, ORed across
    `sample_id`, `location`, the raw `collected_at` string, and any slide
    detection's `species_id`), `status` (exact match against
    `STATUS_CHOICES`; missing/empty/`"All"` = no filter), `location`
    (exact match; missing/empty/`"all"` = no filter, mirroring the
    frontend's `ALL_LOCATIONS` sentinel), and `from`/`to` (inclusive
    `YYYY-MM-DD` bounds compared against the date portion of
    `collected_at` via `Substr`, matching the frontend's own
    `collectedAt.split("T")[0]` comparison). Invalid `status` or malformed
    `from`/`to` → `400 {"detail": "..."}`. All params AND together.
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
  - **`GET /api/v1/reports/monthly-counts/`** (`reports.views.ReportMonthlyCountsView`,
    `IsAuthenticated`; registered in `config/urls.py` **before**
    `<sample_id>/` so that dynamic segment doesn't swallow the literal
    path). Feeds the dashboard's historical pollen chart
    (`PollenCountChart`/`historicalPollenCounts` in
    `app/PolLens/lib/data.ts`). No query params — always returns the
    trailing 12 calendar months ending at the current month, oldest
    first, summing `Detection.grain_count` per species per month
    (`Substr('slide__report__collected_at', 1, 7)` grouping, same pattern
    as the `from`/`to` filter above), only over `status='Completed'`
    reports. Response shape matches `MonthlyPollenCount`: `{"month": "Sep",
    "series": {"amaranthus_spinosus": 0, ...}}` — `series` is keyed
    dynamically off the `Species` table (`all_species_ids()` in
    `reports/views.py`, ordered by `Species.sort_order`), zero-filled for
    every catalog species every month, not a hardcoded per-species struct
    — so it scales automatically if the catalog changes. `month` is a bare
    3-letter abbreviation with no year; the trailing-12-month window makes
    that unambiguous since no month name repeats within it. Months with no
    data return `0`, not an omitted entry. **Wired into the frontend as of
    2026-08-31**: `PollenCountChart` (`app/PolLens/components/PollenCountChart.tsx`)
    fetches this client-side once signed in (`fetchMonthlyPollenCounts` in
    `app/PolLens/lib/data.ts`), falling back to the `historicalPollenCounts`
    seed if signed out or the request fails.
  - **`GET /api/v1/reports/species/`** (`reports.views.SpeciesListView`,
    `IsAuthenticated`; registered in `config/urls.py` before `<sample_id>/`
    for the same reason as `monthly-counts/`). Returns the full 23-species
    catalog as a plain JSON array, ordered by `Species.sort_order` (the
    curated display order, not alphabetical), camelCase fields matching
    `Species` in `app/PolLens/lib/data.ts` exactly (`scientificName`,
    `commonName`, `code`, `season`, `riskLevel`, `color`) — see the Models
    entry below. **Wired into the frontend as of 2026-09-18**: a new
    `useSpeciesCatalog()` hook (`app/PolLens/lib/species-catalog.ts`) fetches
    this endpoint once signed in and swaps it in for the bundled
    `speciesCatalog` fallback (`app/PolLens/lib/data.ts`) — same
    fetch-once-and-silently-swap pattern as `fetchMonthlyPollenCounts`/
    `PollenCountChart` above. The bundled catalog stays in place as the
    fallback and as the data source for PDF/CSV export and the mock
    analysis generator, which don't benefit from live data the way
    on-screen labels do.
  - **`POST /api/v1/reports/detect/`** (`reports.views.DetectView`,
    `IsAuthenticated`; registered in `config/urls.py` before
    `<sample_id>/` for the same reason as `monthly-counts/`/`species/`).
    Stateless proxy for grain detection — called once per uploaded image
    at Analyze-time, before a report/sample id exists, so nothing here is
    persisted (see `POST /api/v1/reports/` above for where an
    already-analyzed batch is later saved). Accepts one `image` file part
    (multipart); forwards it to the Roboflow-hosted model (config-driven
    via `ROBOFLOW_API_KEY`/`ROBOFLOW_MODEL_ID`/`ROBOFLOW_MODEL_VERSION`,
    same `os.environ.get` pattern as `GOOGLE_OAUTH_CLIENT_ID`) and passes
    through Roboflow's native shape trimmed to `{"image": {"width",
    "height"}, "predictions": [{"class", "confidence", "x", "y", "width",
    "height"}]}` (pixel coordinates, box centre-based; `image` is kept so
    the client needs no image decode to normalize) — the
    pixel→normalized `BoundingBox` mapping is client-side in
    `app/PolLens/lib/analysis.ts` (`fromRoboflow`); this view exists only
    to hold the Roboflow API key server-side, not to reshape the response.
    Missing image → `400`. Unconfigured (any of the three env vars blank)
    → `503 {"detail": "Detection service is not configured."}`. Any
    upstream failure (non-200, timeout, connection error) → `502
    {"detail": "Detection service is unavailable."}`.
    - **Mock mode (`ROBOFLOW_MOCK=true`, added 2026-09-23).** The model
      itself isn't deployed yet (the ML/dataset side is still pending), so
      with this flag on the upstream call is replaced by
      `_mock_roboflow_detect`, which serves
      `reports/fixtures/roboflow_detect_response.json` — a full raw
      Roboflow hosted-detect response (`inference_id`, `time`, `image`,
      `predictions[]` with `class_id`/`detection_id`), 16 grains across 4
      catalog species — rescaled onto the uploaded image's real pixel
      size (Pillow) with fresh ids. Credentials aren't checked in mock
      mode. Everything after the payload is obtained is the same code
      path as live, so the frontend is already running the real mapping.
      (`reports/fixtures/` is not a `loaddata` fixture dir despite the
      name.)
    - **Going live:** set `ROBOFLOW_API_KEY`/`ROBOFLOW_MODEL_ID`/
      `ROBOFLOW_MODEL_VERSION` and `ROBOFLOW_MOCK=false` — no code
      changes. **Class-name convention:** the Roboflow dataset's class
      names must be the `Species` slugs (e.g. `amaranthus_spinosus`);
      the frontend forgives case and space/hyphen separators but drops
      any class outside the catalog (with a console warning). If the
      trained model uses other labels, add an alias map in
      `toSpeciesId()` in `app/PolLens/lib/analysis.ts`.
    - **Wired into the frontend as of 2026-09-23**: `analyzeSpecimen()`
      POSTs each image here once signed in, falling back to its local
      deterministic mock when signed out or on any failure.
  - **`GET /api/v1/reports/weather/?lat=..&lon=..` or `?location=...`** (`reports.views.WeatherView`,
    `IsAuthenticated`; registered in `config/urls.py` before
    `<sample_id>/` for the same reason as `monthly-counts/`/`species/`).
    Stateless proxy — current conditions for a collection site, called at
    Analyze-time to pre-fill the manually-entered weather fields
    (`app/PolLens/lib/analysis.ts`'s `fetchWeather` `TODO(backend)`), not
    persisted here. `location` is the same free-text "Town, Province"
    string the frontend already collects, passed through to OpenWeather
    as-is (config-driven via `OPENWEATHER_API_KEY`, same `os.environ.get`
    pattern as the other provider keys). Maps OpenWeather's response onto
    `WeatherConditions { condition, temperatureC, humidityPct, windKph }`
    — since OpenWeather's ~10 weather groups don't map 1:1 onto the app's
    5-value `WeatherCondition` enum, this is a deliberate approximation:
    wind speed ≥30 kph (`WINDY_THRESHOLD_KPH` in `reports/views.py`) is
    classified `"Windy"` ahead of sky condition, then Clear→`"Sunny"`,
    Clouds→`"Partly cloudy"`/`"Overcast"` by cloud-cover percentage, the
    rain family (Thunderstorm/Drizzle/Rain)→`"Rainy"`, and anything else
    falls back to `"Overcast"` as the closest available value. Missing
    `location` and no `lat`/`lon` → `400`. **`lat`/`lon` (added 2026-09-23)** take precedence over `location` when given — the frontend's place search sends the centre of the chosen PSGC town, which OpenWeather always resolves; both must be numbers in range, else `400`. Unconfigured (`OPENWEATHER_API_KEY` blank) → `503
    {"detail": "Weather lookup is not configured."}`. OpenWeather can't
    resolve the location → `404 {"detail": "Location not found."}` (not a
    service failure). Any other upstream failure → `502 {"detail":
    "Weather service is unavailable."}`. As of 2026-09-23,
    `app/PolLens/lib/analysis.ts`'s `fetchWeather()` calls this endpoint
    (null on any failure). The Analyze screen calls it when a place is
    picked from its location search and pre-fills the weather fields,
    which stay editable (researcher override) — decided 2026-09-23.
  - **Models** (`reports/models.py`): `Report` (weather flattened onto the
    model as nullable fields, not a separate table; `collected_at` stored
    as a validated `CharField`, not `DateTimeField`, to preserve the
    frontend's opaque ISO-date-or-datetime string exactly), `Slide` (one
    `ImageField` per slide, served via `MEDIA_URL`/`MEDIA_ROOT` — local
    disk in dev, guarded by `DEBUG` in `config/urls.py`; no production
    media storage, e.g. S3, configured yet), `Species` (the 23-species
    UPLB taxonomic catalog — PK is the slug itself, e.g.
    `amaranthus_spinosus`, plus `scientific_name`, `common_name`, `code`,
    `season`, `risk_level`, `color`, and an explicit `sort_order` since
    Postgres doesn't preserve insertion order; admin-editable via
    `reports.admin.SpeciesAdmin`, `list_editable` on the still-hand-maintained
    metadata fields), `Detection` (per-species summary row), `Grain`
    (optional per-grain bounding box — a slide may have zero).
    `Detection.species`/`Grain.species` are a real `ForeignKey(Species,
    on_delete=PROTECT)` — **as of 2026-09-18**, replacing what used to be a
    plain `CharField(choices=SPECIES_CHOICES)`; `PROTECT` (not `CASCADE`)
    so deleting a `Species` row from admin can't silently wipe out
    historical detections/grains that reference it. The underlying
    `species_id` database column is unchanged (Django's default FK column
    naming for a field named `species` happens to coincide with the old
    CharField's column name), so this was a zero-data-loss, same-column
    migration (`reports/migrations/0003_species.py` creates the table,
    `0004_seed_species.py` seeds the 23 rows, `0005_species_id_to_fk.py`
    — hand-written, since Django's `makemigrations` autodetector proposed
    a drop-and-recreate for the type change rather than an in-place
    rename — converts the column; `0006_recolor_species.py` fixes a chart
    color collision, `pithecellobium_dulce` was sharing a hex with
    `dactyloctenium_aegyptium` — see `app/PolLens/lib/data.ts` for the
    matching frontend-side change). `common_name`/`season` are seeded as
    empty strings, still pending real data (same status as before, just
    DB-backed now instead of a `"TBD"` literal — see the Taxonomic Scope
    row in `../docs/system-spec.md`). `status` choices include
    `Processing`/`Needs review` for schema completeness even though
    nothing writes them yet.
  - **Test coverage**: `reports/tests.py` covers all views — authentication,
    list (empty/populated, filtering by `q`/`status`/`location`/`from`/`to`
    individually and combined, invalid `status`/date param errors), create
    (multipart success, missing weather, missing image, invalid species on
    both `detections[]` and `grains[]`, empty slides, sequential sample-id
    increments), detail (found/404), monthly-counts, the species list
    endpoint (auth-required, curated order, camelCase shape), detect
    (auth required, missing image, unconfigured → 503, successful
    passthrough with extraneous Roboflow fields stripped, upstream
    failure → 502; mock mode: no credentials/network needed, boxes
    rescaled to the uploaded image, every class a catalog species), and weather (auth required, missing location,
    unconfigured → 503, location not found → 404, upstream failure → 502,
    condition-mapping cases for clear/light-clouds/heavy-clouds/rain/
    high-wind). Run with `python manage.py test reports`.
  - **What's still open**: no `PATCH`/`DELETE` (owner is captured for
    this, unused so far). **As of 2026-09-21, `GET`/`POST
    /api/v1/reports/` and `GET /api/v1/reports/<sample_id>/` are wired
    into the frontend** — `app/PolLens/lib/store.ts`'s
    `listReports`/`getReport`/`saveReport` now call these endpoints
    (falling back to seed history when signed out or on failure) instead
    of persisting to IndexedDB, per the root `CLAUDE.md`'s narrow
    frontend-integration exception.
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
