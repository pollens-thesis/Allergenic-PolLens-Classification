"""
Who may see a report, and how its `verification` changes (issue #59).

`status` is the researcher's workflow (Pending -> Needs review -> Completed);
`verification` is whether a verifier (sub-admin or admin) has accepted the
report as trustworthy. Only Verified reports are visible to other people, so
they are the only ones the map, dashboard, trends and exports ever see.
"""

from django.db.models import Q
from django.utils import timezone

AWAITING = 'Awaiting'
VERIFIED = 'Verified'
DECLINED = 'Declined'


def visible_reports(queryset, user):
    """
    Reports `user` may read. Everyone sees their own reports and every Verified
    one. Verifiers also see reports waiting on them or declined, but never other
    people's Pending drafts (not submitted yet). Staff (admins) see everything,
    since they may already edit or delete any report.
    """
    if user.is_staff:
        return queryset
    if user.can_verify:
        return queryset.filter(~Q(status='Pending') | Q(owner=user))
    return queryset.filter(Q(verification=VERIFIED) | Q(owner=user))


def _mark_verified(report, verifier):
    report.verification = VERIFIED
    report.verified_by = verifier
    report.verified_at = timezone.now()
    report.decline_reason = ''


def _mark_awaiting(report):
    report.verification = AWAITING
    report.verified_by = None
    report.verified_at = None
    report.decline_reason = ''


def sync_after_change(report, *, content_changed, submitted_now=False):
    """
    Call after a report is created, finalised or edited, before saving; returns
    the model fields it changed.

    - A report whose owner is a verifier verifies itself at the moment it leaves
      Pending (`submitted_now`) — never later, so a verifier can't clear their
      own declined report by editing or resubmitting it.
    - Otherwise a Verified report whose content changed goes back to Awaiting,
      so what the public sees is always what a verifier looked at. Notes don't
      count as content. A Declined report stays Declined until it is
      resubmitted.
    """
    before = (report.verification, report.verified_by_id, report.decline_reason)
    owner = report.owner
    if owner is not None and owner.can_verify:
        if submitted_now:
            _mark_verified(report, owner)
    elif report.verification == VERIFIED and content_changed:
        _mark_awaiting(report)
    if before == (report.verification, report.verified_by_id, report.decline_reason):
        return []
    return ['verification', 'verified_by', 'verified_at', 'decline_reason']


def decide(report, verifier, approve, reason=''):
    """Record a verifier's ruling on an Awaiting report."""
    if approve:
        _mark_verified(report, verifier)
    else:
        report.verification = DECLINED
        report.verified_by = verifier
        report.verified_at = timezone.now()
        report.decline_reason = reason.strip()
    report.save(update_fields=['verification', 'verified_by', 'verified_at', 'decline_reason'])


def resubmit(report):
    _mark_awaiting(report)
    report.save(update_fields=['verification', 'verified_by', 'verified_at', 'decline_reason'])
