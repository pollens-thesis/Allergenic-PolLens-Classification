# Inference service on Modal

Runs the custom detector + classifier for free. Render's free tier (512 MB)
cannot hold the models, and the free hosts we tried did not work out (issue #42):
Hugging Face now charges for Docker Spaces, and Azure for Students rejected the
account. The service runs on [Modal](https://modal.com), a serverless Python
platform whose free Starter plan includes $30 of compute per month, reset
monthly. The API calls it over HTTPS.

```
Browser → Vercel → Render API (/detect/) → Modal (/detect) → YOLO26-L → crops → EfficientNet-B0
```

Code: `services/inference/` (`app.py` FastAPI service, `modal_app.py` Modal
definition, `upload_models.py`, tests). The two inference modules are **not
duplicated**: `modal_app.py` copies them from `api/reports/inference/` into the
image at deploy time. This replaces the paid-Render path in `docs/yolo26-staging.md`.

## Endpoints

| | |
|---|---|
| `GET /healthz` | open; `{"status":"ok","detector":bool,"classifier":bool}` |
| `POST /detect` | needs `Authorization: Bearer <INFERENCE_TOKEN>`; multipart `image` → `{"image":{"width","height"},"predictions":[{"class","confidence","x","y","width","height"}]}` (pixels, centre-based; same shape the API's `/detect/` returns) |

Errors are `{"detail": ...}`: 401 wrong or missing token, 400 unreadable image,
413 over 25 MB, 503 a model is not loaded or the server has no token configured,
502 inference failed. The service fails closed: with no `INFERENCE_TOKEN` it
refuses requests. A missing detector file does not crash the container;
`/healthz` shows which half is missing.

## One-time setup

1. Sign up at modal.com (GitHub login works). Note whether it asks for a card,
   and check the dashboard for an academic/student credit.
2. In Settings → Usage/Billing set a spending limit or alert, so an accident
   cannot cost money.
3. `pip install modal`, then `modal setup` (opens the browser, stores a token on
   your machine; never commit it).
4. Create the shared secret the service checks:
   ```bash
   modal secret create pollens-inference INFERENCE_TOKEN=$(openssl rand -hex 32)
   ```
   (PowerShell: generate any long random string and paste it.) Keep the same
   value for the API's `INFERENCE_TOKEN` setting later.
5. Put the detector weights `yolo26l_v12_best.pt` (SHA-256
   `3295126e47fc7c8b4814fd44f1882063a035b2ab746ab75f89cf48cb19bfbfad`) at
   `docs/private/model-artifacts/yolo26l-detection-v12/weights/`. Ask the team;
   the file is gitignored and shared privately. The classifier is read from
   `docs/private/finalized model/classification/`.

## Deploy / update

```bash
python services/inference/upload_models.py          # weights → Modal Volume `pollens-models`
modal deploy services/inference/modal_app.py        # builds the image, prints the URL
```

No detector file yet? Use `upload_models.py --skip-detector` (and `--dry-run` to
only check files). Re-run `modal deploy` after changing `app.py` or the
inference modules; re-run `upload_models.py` after changing weights.
Weights live in the Modal Volume only and never in GitHub.

## Test

```bash
URL=https://<workspace>--pollens-inference-inference-web.modal.run   # printed by modal deploy
curl $URL/healthz
curl -H "Authorization: Bearer $INFERENCE_TOKEN" -F image=@slide.jpg $URL/detect
```

Without the header `/detect` must return 401. Local tests (no models needed):
`pip install fastapi httpx pillow pytest python-multipart && pytest services/inference`.

## Cost and cold starts

- The container is 1 CPU / 2 GiB and scales to zero after 5 minutes idle, so an
  idle service costs nothing. Always-on (`min_containers=1`) would cost more than
  the monthly credit, so it is not used.
- By our estimate from Modal's published rates (about $0.0000175 per second for
  this size) a request that wakes a cold container costs well under a cent,
  thousands per month inside the credit. Confirm on modal.com/pricing and the
  dashboard; record real numbers here after the first deploy.
- The first request after an idle period has to start the container and load both
  models. `modal_app.py` enables memory snapshots to make this faster. If a
  deploy fails or a restored container misbehaves, set `SNAPSHOT = False` in
  `modal_app.py`. The API's timeout must allow a slow first request.
- Free-plan terms can change. The service is a plain FastAPI app, so moving it to
  another host later means replacing only `modal_app.py`.

## Scope

15 species only (the catalog has 23); accuracy is within-slide and not yet
measured end to end (see `docs/yolo26-staging.md`). Tuning env vars:
`YOLO26_CONFIDENCE` (0.25), `YOLO26_IMAGE_SIZE` (640).
