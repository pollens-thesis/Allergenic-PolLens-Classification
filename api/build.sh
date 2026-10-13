#!/usr/bin/env bash
# Render build step (see render.yaml). Migrations run here rather than in a
# pre-deploy hook because Render's free tier has none; the database (Neon) is
# external, so it is reachable at build time.
set -o errexit

pip install -r requirements.txt

# Keep the production build lightweight unless a model-enabled service opts in.
# The YOLO26 staging Blueprint sets this at build time; the production
# Blueprint leaves it unset: production calls the hosted inference service.
if [[ "${INSTALL_ML_DEPENDENCIES:-false}" == "true" ]]; then
  pip install -r requirements-ml.txt
fi

python manage.py collectstatic --noinput
python manage.py migrate --noinput
