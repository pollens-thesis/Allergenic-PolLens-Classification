# Login / Session Handoff — Frontend

> **Update 2026-09-24 — built.** All four gaps below are closed in
> `app/PolLens/` (user-requested): `lib/api.ts` `apiFetch` attaches the
> Bearer token, refreshes shortly before expiry and once on a 401 (then
> retries), single-flights refresh per tab and across tabs (Web Locks,
> re-reading storage so rotation can't race), and on a rejected refresh
> clears the session and sends the user to `/?next=<page>&reason=expired`.
> Every backend call goes through it. Protected routes live in the
> `app/(app)/` route group whose layout renders `components/SessionGuard.tsx`
> — client-side (option **b** below) because the session is in localStorage,
> with a placeholder until hydration so nothing flashes. Sign-out
> (`lib/session.ts` `signOut()`) revokes the refresh token via `/logout/`
> (best-effort, 4 s timeout) before clearing locally. The sign-in page
> honours a local-path-only `?next=`. Still optional/unbuilt: surfacing
> `institution` from `/me/`. The rest of this doc is the original handoff,
> kept for the rationale.

**Status as of 2026-08-30.** The Google OAuth login *handshake* is fully
built and tested on the backend. What's missing is everything that turns a
successful login into an actual **session** — route protection, using the
tokens on later requests, recovering from an expired access token, and a
real sign-out. All four of those are frontend work; nothing here needs a
new backend endpoint.

This doc is the handoff for that remaining work. It's also intentionally
narrow scope: closing these four gaps, not a general auth refactor.

For the authoritative, currently-accurate contract of every backend
endpoint, see `../api/CLAUDE.md`'s Auth section — if anything here ever
looks stale next to that file, trust `api/CLAUDE.md`. For the full
paper-vs-frontend reconciliation and a running list of what's still open
on this feature, see the Google OAuth 2.0 Login row and the System
Information & Logout row in `system-spec.md`.

## 1. What the backend already provides

| Endpoint | Auth | Request body | Response |
|---|---|---|---|
| `POST /api/v1/auth/google/` | none | `{ "id_token": "<GIS credential>" }` | `200 { "access": "...", "refresh": "..." }` |
| `GET /api/v1/auth/me/` | Bearer | — | `200 { "email": "...", "institution": "..." }` |
| `POST /api/v1/auth/logout/` | Bearer | `{ "refresh": "<token>" }` | `200 { "detail": "Successfully logged out." }` — blacklists that refresh token |
| `POST /api/v1/auth/token/refresh/` | none (stock SimpleJWT) | `{ "refresh": "<token>" }` | `200 { "access": "...", "refresh": "..." }` — issues a new pair and blacklists the old refresh token (rotation is on) |

Every error response from `/google/`, `/logout/`, and `/me/` is
`{ "detail": "<message>" }` with an appropriate 4xx/5xx status — no other
envelope, no `code` field.

`Authorization: Bearer <access>` is the header shape `JWTAuthentication`
expects (standard DRF SimpleJWT).

**Access tokens live 15 minutes; refresh tokens live 7 days**, with
rotation + blacklist-after-rotation both on — a used-once refresh token
can't be replayed, and `/logout/` gives you a way to kill one on demand.

### Already in place client-side

- `lib/auth.ts` — `exchangeGoogleCredential(credential)` calls
  `POST /api/v1/auth/google/` and returns `{ email, tokens: { access,
  refresh } }`.
- `lib/settings.ts` — `Settings.accessToken` / `Settings.refreshToken`
  are already typed and stored (written once, at sign-in, by
  `SignInForm.tsx`). Nothing else reads them yet — see below.

## 2. What's missing

Confirmed by grepping the whole frontend (excluding `node_modules`):

- **No route/session guard anywhere.** No `middleware.ts` exists in the
  project. `/dashboard`, `/settings`, `/upload`, `/reports`, `/map`, etc.
  all render fully with zero session state — signed in or not, they're
  identical.
- **The access token is never attached to anything.** `accessToken` and
  `refreshToken` are referenced in exactly two places in the whole repo:
  where `SignInForm.tsx` writes them via `updateSettings(...)`, and their
  type definition in `lib/settings.ts`. No `fetch`/`Authorization` header
  construction exists anywhere else.
- **No refresh/401 handling.** Nothing calls
  `POST /api/v1/auth/token/refresh/`. There's no expiry tracking and no
  401-response interceptor/retry — an access token just silently goes
  stale 15 minutes after login with nothing to recover it.
- **Sign-out doesn't tell the backend.** The "Sign out" button in
  `components/SettingsWorkspace.tsx` calls only `resetSettings()`
  (`lib/settings.ts` — clears `localStorage`, redirects to `/`). It never
  calls `POST /api/v1/auth/logout/`, so the refresh token from a "signed
  out" browser stays valid server-side for up to 7 days.

## 3. Recommended shape

Treat this as one small session layer, not four independent patches —
they share the same state (`useSettings()`) and the same failure mode
(no valid access token).

Suggested pieces:

- **A thin authenticated-fetch wrapper** (e.g. `lib/apiClient.ts`) that
  reads `accessToken` from `useSettings()`/`getSnapshot()`, attaches
  `Authorization: Bearer <token>`, and on a `401` tries
  `POST /api/v1/auth/token/refresh/` with the stored `refreshToken`
  exactly once — on success, store the new pair (rotation means the old
  refresh token is now dead, so the new one must be persisted) and retry
  the original request; on failure, treat it as signed-out.
- **Route protection** for `/dashboard`, `/settings`, `/upload`,
  `/reports`, `/map` (and any other page that assumes a signed-in user).
  Two viable approaches — pick one, nothing in the current frontend
  signals a preference:
  - `middleware.ts` at the project root, checking for the session
    cookie/token and redirecting to `/` — works even before hydration,
    but the session currently lives in `localStorage`, which middleware
    (server-side) can't read directly, so this would need the session
    moved to (or mirrored into) a cookie.
  - A per-page/layout client-side check using `useSettings()`, redirecting
    in an effect if `email`/`accessToken` is empty — simpler given the
    session is already `localStorage`-based, but allows a flash of
    protected content before the redirect fires.
- **Wire "Sign out"** in `SettingsWorkspace.tsx` to call
  `POST /api/v1/auth/logout/` with the stored `refreshToken` (via the new
  fetch wrapper, since it's itself an authenticated call) *before*
  `resetSettings()` clears local state. Best-effort: if the network call
  fails, still clear local state and redirect — a failed logout call
  shouldn't trap the user signed in on their own browser.
- **Surface `institution`** (optional, separate from the four gaps above
  but worth doing while this area is being touched): `GET /api/v1/auth/me/`
  returns the real Google `hd` claim; `lib/account.ts`'s
  `institutionFromEmail()` heuristic could be replaced by this once a
  session layer exists to call it. Not required for this handoff — flag
  it as a follow-up, not a blocker.

## 4. Source of truth

- Backend contracts: `../api/CLAUDE.md` (Auth section).
- Feature status / paper reconciliation: `system-spec.md` — Google OAuth
  2.0 Login row and System Information & Logout row.

If this doc and either of those disagree, the two files above win — update
this doc to match, not the other way around.
