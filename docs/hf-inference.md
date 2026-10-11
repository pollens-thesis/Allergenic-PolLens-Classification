# Hugging Face inference Space

Runs the custom detector + classifier for free. Render's free tier (512 MB)
cannot hold the models, so they live on a private Hugging Face **Docker Space**
(CPU basic: 2 vCPU, 16 GB RAM, $0) and the API calls it over HTTP. Issue #42.
This replaces the paid-Render path in `docs/yolo26-staging.md`.

```
Browser → Vercel → Render API (/detect/) → HF Space (/detect) → YOLO26-L → crops → EfficientNet-B0
```

Code: `services/hf-inference/` (FastAPI app, Dockerfile, `deploy.py`, tests). The
two inference modules are **not duplicated**: `deploy.py` copies them from
`api/reports/inference/` at publish time.

## Endpoints

| | |
|---|---|
| `GET /healthz` | `{"status":"ok","detector":bool,"classifier":bool}` |
| `POST /detect` | multipart `image` → `{"image":{"width","height"},"predictions":[{"class","confidence","x","y","width","height"}]}` (pixels, centre-based; same shape the API's `/detect/` returns) |

Errors are `{"detail": ...}`: 400 unreadable image, 413 over 25 MB, 503 a model
is not loaded, 502 inference failed. A missing detector file does not crash the
container; `/healthz` shows which half is missing.

## One-time setup

1. Create a free org on huggingface.co (New Organization), e.g. `pollens-thesis`.
2. Settings → Access Tokens → create a **write** token for that org, then
   `hf auth login` and paste it.
3. Put the detector weights `yolo26l_v12_best.pt` (SHA-256
   `3295126e47fc7c8b4814fd44f1882063a035b2ab746ab75f89cf48cb19bfbfad`) at
   `docs/private/model-artifacts/yolo26l-detection-v12/weights/`. Ask the team;
   the file is gitignored and shared privately. The classifier is read from
   `docs/private/finalized model/classification/`.

## Deploy / update

```bash
pip install huggingface_hub
python services/hf-inference/deploy.py --repo-id pollens-thesis/pollens-inference
# detector not available yet?  add --skip-detector   (checks only: --dry-run)
```

It verifies the detector hash, stages everything in a temp folder, creates the
Space (private, Docker) if needed and uploads. Re-running updates it and
rebuilds. Weights are stored in the Space repo (LFS) and never in GitHub.

## Test

```bash
TOKEN=<HF read token>
URL=https://pollens-thesis-pollens-inference.hf.space
curl -H "Authorization: Bearer $TOKEN" $URL/healthz
curl -H "Authorization: Bearer $TOKEN" -F image=@slide.jpg $URL/detect
```

Local tests (no models needed): `pip install fastapi httpx pillow pytest
python-multipart && pytest services/hf-inference`.

## Things to know

- **Private Space:** Hugging Face requires the bearer token on every request, so
  the API (next PR) sends an HF read token; keep it in Render's env, never in git.
- **Sleep:** free Spaces sleep after ~48 h idle; the first request then takes
  roughly 30–60 s while it wakes and loads the models, so the API's timeout must
  be generous. A daily ping from GitHub Actions to keep it awake is planned, not built yet.
- **Disk is ephemeral** and nothing is stored there; weights ship with the repo.
- **Scope:** 15 species only (the catalog has 23); accuracy is within-slide and
  not yet measured end to end (see `docs/yolo26-staging.md`).
- Tuning env vars on the Space: `YOLO26_CONFIDENCE` (0.25), `YOLO26_IMAGE_SIZE` (640).
