#!/usr/bin/env bash
# Provider-aware Render start command. Roboflow remains the default so the
# existing production service keeps working until an operator selects YOLO26.
set -euo pipefail

backend="$(printf '%s' "${DETECTION_BACKEND:-roboflow}" | tr '[:upper:]' '[:lower:]')"

if [[ "$backend" == "yolo26" ]]; then
  python -m scripts.prepare_yolo26_models
  export YOLO26_WARM_MODELS_ON_START=true
  worker_count=1
  request_timeout="${GUNICORN_TIMEOUT:-120}"
elif [[ "$backend" == "remote" ]]; then
  # The models live on the hosted inference service, so this process stays
  # small. The timeout must exceed INFERENCE_TIMEOUT (default 120 s), or
  # gunicorn kills the worker while it waits out a cold start.
  worker_count="${GUNICORN_WORKERS:-2}"
  request_timeout="${GUNICORN_TIMEOUT:-130}"
elif [[ "$backend" == "roboflow" ]]; then
  worker_count="${GUNICORN_WORKERS:-2}"
  request_timeout="${GUNICORN_TIMEOUT:-60}"
else
  printf 'Unsupported DETECTION_BACKEND: %s\n' "$backend" >&2
  exit 1
fi

exec gunicorn config.wsgi:application --workers "$worker_count" --timeout "$request_timeout"
