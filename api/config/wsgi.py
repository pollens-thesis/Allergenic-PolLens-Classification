"""
WSGI config for config project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.1/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

application = get_wsgi_application()

# A model-enabled Render staging instance should fail its worker boot if the
# private artifacts or model runtimes are not usable. This runs in each worker
# process, so the staging start command uses one worker to avoid duplicate model
# copies. Local development and the production service (which calls the hosted
# inference service) remain lazy.
if (
    os.environ.get('DETECTION_BACKEND', 'remote').strip().lower() == 'yolo26'
    and os.environ.get('YOLO26_WARM_MODELS_ON_START', '').strip().lower()
    in ('1', 'true', 'yes', 'on')
):
    from django.conf import settings

    from reports.views import _yolo26_classifier, _yolo26_detector

    _yolo26_classifier(settings.YOLO26_CLASSIFIER_WEIGHTS_PATH)
    _yolo26_detector(settings.YOLO26_WEIGHTS_PATH)
