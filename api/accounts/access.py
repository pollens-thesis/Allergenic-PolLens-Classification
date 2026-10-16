"""
Who may use PolleRgies — an allowlist applied to every sign-in (Google or
Microsoft) and re-checked on every authenticated request, so removing someone
takes effect immediately rather than when their tokens expire.

SIGNIN_ALLOW_ALL=true admits any account that can prove an email address
(issue #9: the app is open to everyone, and a verifier checks each user's
reports before they go public). It is an explicit switch, default off.

Otherwise SIGNIN_ALLOWED_DOMAINS admits a domain and all of its subdomains
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
    return user is not None and user.is_active and may_sign_in(user)


def may_sign_in(user):
    """An admin is always let in, so a closed allowlist can never lock out the people running the app."""
    return user.is_superuser or is_allowed(user.email)


def is_allowed(email):
    email = (email or '').strip().lower()
    if '@' not in email:
        return False
    if settings.SIGNIN_ALLOW_ALL:
        return True
    if email in settings.SIGNIN_ALLOWED_EMAILS:
        return True
    return _domain_allowed(email.rsplit('@', 1)[1], settings.SIGNIN_ALLOWED_DOMAINS)
