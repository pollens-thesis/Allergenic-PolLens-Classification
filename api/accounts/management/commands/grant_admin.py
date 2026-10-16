import os
import re

from django.core.management.base import BaseCommand, CommandError

from accounts.models import User


def emails_from_env(name='ADMIN_EMAILS'):
    """Addresses in an env var, separated by commas, spaces or newlines; lower-cased, blanks skipped."""
    return [email.lower() for email in re.split(r'[,\s;]+', os.environ.get(name, '')) if email]


class Command(BaseCommand):
    help = (
        'Make an account an admin (is_superuser + is_staff), or take it away with '
        '--revoke. With --from-env, make every address in ADMIN_EMAILS an admin, '
        'creating the account if the person has not signed in yet (their first '
        'sign-in uses it); that form only adds admins and never revokes.'
    )

    def add_arguments(self, parser):
        parser.add_argument('email', nargs='?')
        parser.add_argument('--revoke', action='store_true', help='Remove admin rights.')
        parser.add_argument(
            '--from-env', action='store_true',
            help='Add the addresses listed in ADMIN_EMAILS as admins (run at deploy).',
        )

    def handle(self, *args, email, revoke, from_env, **options):
        if from_env:
            if email or revoke:
                raise CommandError('--from-env takes no email and cannot be combined with --revoke.')
            return self.grant_from_env()
        if not email:
            raise CommandError('Give an email address, or use --from-env.')
        user = User.objects.filter(email__iexact=email.strip()).first()
        if user is None:
            raise CommandError(f'No account for {email}. They must sign in once first.')
        user.is_superuser = user.is_staff = not revoke
        user.save(update_fields=['is_superuser', 'is_staff'])
        verb = 'is no longer' if revoke else 'is now'
        self.stdout.write(self.style.SUCCESS(f'{user.email} {verb} an admin.'))

    def grant_from_env(self):
        emails = emails_from_env()
        if not emails:
            self.stdout.write('ADMIN_EMAILS is empty; no admins configured.')
            return
        for email in emails:
            user = User.objects.filter(email__iexact=email).first()
            created = user is None
            if created:
                user = User(email=email)
                user.set_unusable_password()
            # An existing account keeps its other flags: a blocked admin stays blocked.
            user.is_superuser = user.is_staff = True
            user.save()
            state = 'created' if created else 'updated'
            self.stdout.write(self.style.SUCCESS(f'{user.email} is an admin ({state}).'))
