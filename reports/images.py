"""
Slide image checks shared by POST /api/v1/reports/ and POST .../detect/.

Only JPEG and PNG are accepted (what microscope cameras produce and every
browser can display), up to MAX_SLIDE_IMAGE_BYTES each — the paper's upload
limit (test cases TC-US-01 / TC-BB-01). The format is read from the file's
contents with Pillow, never trusted from the client's filename or MIME type,
and the stored extension is derived from it.
"""

from django.conf import settings
from PIL import Image, UnidentifiedImageError

ALLOWED_FORMATS = {'JPEG': '.jpg', 'PNG': '.png'}


class SlideImageError(ValueError):
    def __init__(self, message, too_large=False):
        super().__init__(message)
        self.too_large = too_large


def check_slide_image(upload):
    """
    Returns the canonical extension ('.jpg'/'.png') for an uploaded file, or
    raises SlideImageError with a message for the researcher. Leaves the file
    positioned at the start so it can be saved or forwarded afterwards.
    """
    limit = settings.MAX_SLIDE_IMAGE_BYTES
    if upload.size > limit:
        raise SlideImageError(
            f'"{upload.name}" is larger than {limit // (1024 * 1024)} MB.', too_large=True,
        )
    try:
        upload.seek(0)
        with Image.open(upload) as img:
            fmt = img.format
            img.verify()  # structural check without decoding every pixel
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError):
        raise SlideImageError(f'"{upload.name}" is not a readable image.')
    finally:
        upload.seek(0)
    if fmt not in ALLOWED_FORMATS:
        raise SlideImageError(f'"{upload.name}" is {fmt or "an unsupported format"}; use JPEG or PNG.')
    return ALLOWED_FORMATS[fmt]
