"""
Slide image checks shared by POST /api/v1/reports/ and POST .../detect/.

Only JPEG and PNG are accepted (what microscope cameras produce and every
browser can display; phone "JPEG"s that Pillow reports as MPO count as JPEG), up to MAX_SLIDE_IMAGE_BYTES each — the paper's upload
limit (test cases TC-US-01 / TC-BB-01). The format is read from the file's
contents with Pillow, never trusted from the client's filename or MIME type,
and the stored extension is derived from it.
"""

from django.conf import settings
from PIL import Image, UnidentifiedImageError

# MPO is the multi-picture container phones (iPhones especially) write for
# ".jpeg" photos: its first frame is a plain JPEG that browsers and Roboflow
# read as one, so it is accepted and stored as .jpg.
ALLOWED_FORMATS = {'JPEG': '.jpg', 'MPO': '.jpg', 'PNG': '.png'}


# The classifier is trained for the 10x eyepiece / 40x objective setup. A
# digital-zoom ratio above 1 in EXIF means the phone was zoomed. The 35 mm
# focal length is deliberately not used: the project's own 400x reference photo
# reports 52 mm (the phone's 2x lens), so it can't tell supported from zoomed.
MAX_DIGITAL_ZOOM = 1.05
EXIF_IFD = 0x8769
EXIF_DIGITAL_ZOOM_RATIO = 0xA404


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
            width, height = img.size
            img.verify()  # structural check without decoding every pixel
    except Image.DecompressionBombError:
        raise SlideImageError(f'"{upload.name}" has too many pixels to analyze.', too_large=True)
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError):
        raise SlideImageError(f'"{upload.name}" is not a readable image.')
    finally:
        upload.seek(0)
    # A tiny compressed file can still expand to an enormous image in memory.
    if width * height > settings.MAX_SLIDE_IMAGE_PIXELS:
        raise SlideImageError(
            f'"{upload.name}" is {width}×{height} pixels; the limit is '
            f'{settings.MAX_SLIDE_IMAGE_PIXELS // 1_000_000} megapixels.',
            too_large=True,
        )
    if fmt not in ALLOWED_FORMATS:
        raise SlideImageError(f'"{upload.name}" is {fmt or "an unsupported format"}; use JPEG or PNG.')
    return ALLOWED_FORMATS[fmt]


def exif_zoomed_in(upload):
    """
    True when the photo's EXIF digital-zoom ratio says the phone was zoomed. False when there is no EXIF or it can't be read: absence of
    evidence is not a warning. Leaves the file positioned at the start.
    """
    try:
        upload.seek(0)
        with Image.open(upload) as img:
            exif = img.getexif().get_ifd(EXIF_IFD)
        zoom = float(exif.get(EXIF_DIGITAL_ZOOM_RATIO) or 0)
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError, TypeError, ZeroDivisionError):
        return False
    finally:
        upload.seek(0)
    return zoom > MAX_DIGITAL_ZOOM
