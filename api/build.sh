#!/usr/bin/env bash
# Render build step (see render.yaml). Migrations run here rather than in a
# pre-deploy hook because Render's free tier has none; the database (Neon) is
# external, so it is reachable at build time.
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --noinput
python manage.py migrate --noinput
