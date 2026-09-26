from django.conf import settings
from django.core.checks import Warning, register


@register(deploy=True)
def media_storage_check(app_configs, **kwargs):
    if not settings.DEBUG and not settings.AWS_STORAGE_BUCKET_NAME:
        return [Warning(
            'AWS_STORAGE_BUCKET_NAME is not set: slide images are stored on local disk, '
            'which the host wipes on every deploy (and nothing serves /media/ with DEBUG off).',
            hint='Set the Cloudflare R2 variables — see docs/deployment.md step 1.',
            id='pollens.W001',
        )]
    return []
