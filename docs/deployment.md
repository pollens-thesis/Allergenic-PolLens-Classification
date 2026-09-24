# Deploying PolLens

Where each part runs:

| Part | Where | Repo |
|---|---|---|
| Frontend (Next.js) | **Vercel** | `ninoninonino19/PolLens` (`app/PolLens/`) |
| API (Django) | **Render** (free web service) | `0ban4/PolLens-Thesis` (`api/`) |
| Database | **Neon** Postgres (project already provisioned) | — |
| Slide images | **Cloudflare R2** (S3-compatible, private bucket) | — |

The code side is done: both repos build and are configured from environment
variables (see `api/CLAUDE.md` → *Deployment*). What's left is creating the
accounts and pasting values, in this order. It takes about 30–45 minutes.

Two services have to know each other's address. Render goes first with a
placeholder, Vercel gets Render's URL, and then Render gets Vercel's.

Keep a scratch note open. You'll collect these values as you go:

```
R2_ACCOUNT_ID=            (step 1)
R2_ACCESS_KEY_ID=         (step 1)
R2_SECRET_ACCESS_KEY=     (step 1)
RENDER_URL=               (step 2, e.g. https://pollens-api.onrender.com)
VERCEL_URL=               (step 3, e.g. https://pollens.vercel.app)
```

---

## 1. Cloudflare R2: slide image storage

1. Sign in at <https://dash.cloudflare.com> and open **R2 Object Storage**.
   The first time, R2 asks you to enable it. This needs a payment method on
   file; the free tier is 10 GB with no bandwidth fees.
2. **Create bucket**:
   - Name: `pollens-media`.
   - Location: Automatic (or Asia-Pacific).
   - Leave **Public access off**. The API hands out signed links that expire,
     because slide file names are guessable.
3. Copy your **Account ID** from the R2 overview page's side panel into
   `R2_ACCOUNT_ID`.
4. Go to **Manage R2 API Tokens** → **Create API token**:
   - Permissions: **Object Read & Write**.
   - Specify bucket: `pollens-media`.
   - Create, then copy **Access Key ID** and **Secret Access Key** into your
     note. The secret is shown only once.
5. Open the `pollens-media` bucket → **Settings** → **CORS Policy** → Add.
   You'll add the Vercel URL in step 4; for now paste:
   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000"],
       "AllowedMethods": ["GET", "HEAD"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
   This lets the browser download slide images to build report PDFs. Plain
   `<img>` display doesn't need it.

## 1b. Microsoft Entra: the "Continue with Microsoft" app (optional)

Skip this step if you only want Google sign-in. The Microsoft button stays
hidden while no client ID is set.

1. Go to <https://portal.azure.com> → **Microsoft Entra ID** → **App registrations**
   → **New registration**.
   - Name: `PolLens`.
   - Supported account types: **Accounts in any organizational directory
     (Any Microsoft Entra ID tenant — Multitenant)**.
   - Redirect URI: platform **Single-page application (SPA)**, URI
     `http://localhost:3000/auth/microsoft`.
2. Register, then copy the **Application (client) ID** into your note as
   `MICROSOFT_CLIENT_ID`. No client secret is needed.
3. In step 4 you'll add the Vercel redirect URI the same way.

A school's Microsoft 365 may ask an administrator to approve a new app the
first time someone from that school signs in ("Need admin approval"). If UP or
MSEUF IT blocks it, Google sign-in still works.

## 2. Render: the API

1. Sign in at <https://render.com> with GitHub, as the account that owns
   `0ban4/PolLens-Thesis`.
2. **New** → **Blueprint** → pick `0ban4/PolLens-Thesis`. Render reads
   `render.yaml` and proposes one web service, `pollens-api` (free plan,
   Singapore region).
3. Fill in the values it asks for:

   | Key | Value |
   |---|---|
   | `DATABASE_NAME` / `DATABASE_USER` / `DATABASE_PASSWORD` / `DATABASE_HOST` | From the **Neon dashboard** → your project → **Connect**: database, role, password and host. Use the host **without** `-pooler`. Your local `api/.env` points at a Postgres on your own machine, not Neon, so don't copy those. |
   | `CORS_ALLOWED_ORIGINS` | `http://localhost:3000` for now (step 4 replaces it) |
   | `GOOGLE_OAUTH_CLIENT_ID` | Same as local `api/.env` |
   | `MICROSOFT_CLIENT_ID` | From step 1b (leave empty to disable Microsoft sign-in) |
   | `SIGNIN_ALLOWED_EMAILS` | Individual addresses allowed in besides the domains, comma-separated (e.g. your Gmail, the adviser) |
   | `AWS_STORAGE_BUCKET_NAME` | `pollens-media` |
   | `AWS_S3_ENDPOINT_URL` | `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com` |
   | `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | From step 1.4 |
   | `OPENWEATHER_API_KEY` | Your OpenWeather key (optional; without it weather stays manual) |
   | `ROBOFLOW_API_KEY` / `ROBOFLOW_MODEL_ID` / `ROBOFLOW_MODEL_VERSION` | Leave empty. `ROBOFLOW_MOCK=true` serves sample detections until the model exists. |

   `DJANGO_SECRET_KEY` is generated for you, and `DJANGO_DEBUG` is already
   `false`.
4. **Apply**. The build runs `build.sh`: install, collect static files, and
   migrate the Neon database. The first build takes a few minutes.
5. When it's live, copy the service URL into `RENDER_URL` and open
   `RENDER_URL/healthz/`. It should show `{"status": "ok"}`.

The free plan sleeps after 15 minutes idle, and the next request takes about
30–60 s to wake it. Before a demo, open `/healthz/` a minute early. The
Starter plan ($7/mo) stays awake.

## 3. Vercel: the frontend

1. Sign in at <https://vercel.com> with GitHub. **Importing
   `ninoninonino19/PolLens` needs access to that repo.** Either the frontend
   developer adds you as a collaborator, or they do this step themselves.
2. **Add New** → **Project** → import `PolLens`. Framework preset: **Next.js**
   (detected). Leave the root directory and build settings at their defaults.
3. **Environment Variables**:
   - `NEXT_PUBLIC_API_BASE_URL` = `RENDER_URL` (no trailing slash)
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID` = same Google client ID as in step 2
   - `NEXT_PUBLIC_MICROSOFT_CLIENT_ID` = the Microsoft client ID from step 1b (optional)
4. **Deploy**. Copy the production domain into `VERCEL_URL`, e.g.
   `https://pollens.vercel.app`.

These variables are built into the page at build time. If you change them
later, use **Deployments** → **⋯** → **Redeploy**.

## 4. Connect them

1. **Render** → `pollens-api` → **Environment** → set `CORS_ALLOWED_ORIGINS`
   = `VERCEL_URL`. To keep local development working against the deployed
   API, use `VERCEL_URL,http://localhost:3000`. Save; Render redeploys.
2. **Google Cloud Console** → **APIs & Services** → **Credentials** → your
   OAuth 2.0 Client ID → **Authorized JavaScript origins** → add `VERCEL_URL`
   → Save. It can take a few minutes to take effect.
3. **Cloudflare R2** → `pollens-media` → **Settings** → **CORS Policy** → add
   `VERCEL_URL` to `AllowedOrigins`.
4. **Microsoft Entra** (if you did step 1b) → your app → **Authentication** →
   Single-page application → add `VERCEL_URL/auth/microsoft` → Save.

**Who can sign in:** `SIGNIN_ALLOWED_DOMAINS` defaults to
`up.edu.ph,mseuf.edu.ph`; a domain also admits its subdomains, e.g.
`student.mseuf.edu.ph`. Anyone else needs to be listed in
`SIGNIN_ALLOWED_EMAILS`. Changes on Render take effect on the researcher's next
request.

## 5. Smoke test

Open `VERCEL_URL` and check each step:

- [ ] Opening `/reports` directly redirects to the sign-in page.
- [ ] **Continue with Google** signs you in and lands on the Dashboard.
- [ ] **Analyze Specimen**: type "cand" and pick Candelaria, Quezon. The
  weather fills in, if the OpenWeather key is set.
- [ ] Upload a slide image and run **Analyze Specimen**. Boxes appear (sample
  detections from mock mode).
- [ ] **Open Inspector**: zoom, select a type and a grain.
- [ ] **Save Report** → it appears in **Reports** → open it. The slide image
  loads from R2.
- [ ] Download the report PDF. The image should be included; this is the R2
  CORS check.
- [ ] **Settings** → **Sign Out** returns you to the sign-in page.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Browser console: *blocked by CORS policy* on `/api/v1/...` | `CORS_ALLOWED_ORIGINS` on Render doesn't exactly match `VERCEL_URL`: scheme, no trailing slash. |
| Google button: *origin is not allowed for the client ID* | Step 4.2 isn't saved yet, or it's still propagating. |
| Sign-in fails with *Invalid Google token* | Vercel and Render use different Google client IDs. |
| *This account isn't authorised to use PolLens* | The email isn't on the allowlist: add its domain to `SIGNIN_ALLOWED_DOMAINS` or the address to `SIGNIN_ALLOWED_EMAILS` on Render. |
| Microsoft popup: *redirect URI mismatch* | Add `VERCEL_URL/auth/microsoft` as an SPA redirect URI (step 4.4). |
| Microsoft: *Need admin approval* | The school tenant requires admin consent for new apps; ask its IT, or use Google. |
| API returns **400 Bad Request** | Host not allowed. Render's own hostname is added automatically; a custom domain needs adding to `DJANGO_ALLOWED_HOSTS`. |
| Report images broken / 403 | Check the `AWS_*` values on Render: the endpoint must use the account ID, and the token must cover the bucket. |
| PDF has no images | R2 CORS policy is missing `VERCEL_URL`. |
| First request hangs ~1 min | Free-tier cold start, see step 2. |
| Render build fails at `migrate` | Wrong `DATABASE_*` values, or the Neon project is suspended. Check the Neon dashboard. |
| Session keeps expiring | Renewal needs the API reachable. Check Render's logs. |

## Notes

- **Data:** production uses the Neon database; local development uses your
  own Postgres. Reports saved locally, and their images in `api/media/`, are
  **not** copied over. The deployed app starts with the sample history plus
  whatever is already in Neon. The first build's `migrate` brings Neon's
  schema up to date, including the species catalog.
- **Going live with the real model:** on Render, set `ROBOFLOW_API_KEY`,
  `ROBOFLOW_MODEL_ID` and `ROBOFLOW_MODEL_VERSION`, and set
  `ROBOFLOW_MOCK=false`. No code changes, provided the model's class names are
  the species IDs; see `api/CLAUDE.md` → DetectView.
- **Vercel preview deployments** get per-branch URLs. To let them call the
  API, set `CORS_ALLOWED_ORIGIN_REGEXES` on Render, e.g.
  `^https://pollens-[a-z0-9-]+\.vercel\.app$`, and add those origins in
  Google Console if you want to sign in on previews.
