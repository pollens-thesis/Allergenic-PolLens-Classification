"""
Who may use PolLens — an allowlist applied to every sign-in (Google or
Microsoft) and re-checked on every authenticated request, so removing someone
takes effect immediately rather than when their tokens expire.

SIGNIN_ALLOWED_DOMAINS admits a domain and all of its subdomains
("mseuf.edu.ph" also admits "student.mseuf.edu.ph"); SIGNIN_ALLOWED_EMAILS
admits individual addresses. Both empty admits nobody: a misconfigured
deployment fails closed, never open.
"""

from django.conf import settings


def _domain_allowed(domain, allowed):
    return any(domain == entry or domain.endswith('.' + entry) for entry in allowed)


def user_can_authenticate(user):
    """
    SimpleJWT's USER_AUTHENTICATION_RULE: an active, allowlisted user. Also
    applied when refreshing tokens, so someone removed from the list can't
    keep a session alive by refreshing.
    """
    return user is not None and user.is_active and is_allowed(user.email)


def is_allowed(email):
    email = (email or '').strip().lower()
    if '@' not in email:
        return False
    if email in settings.SIGNIN_ALLOWED_EMAILS:
        return True
    return _domain_allowed(email.rsplit('@', 1)[1], settings.SIGNIN_ALLOWED_DOMAINS)
