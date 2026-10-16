from django.core.management.base import BaseCommand, CommandError

from accounts.models import User


class Command(BaseCommand):
    help = (
        'Make an existing account an admin (is_superuser + is_staff), or take it '
        'away with --revoke. The person must have signed in once so the account exists.'
    )

    def add_arguments(self, parser):
        parser.add_argument('email')
        parser.add_argument('--revoke', action='store_true', help='Remove admin rights.')

    def handle(self, *args, email, revoke, **options):
        user = User.objects.filter(email__iexact=email.strip()).first()
        if user is None:
            raise CommandError(f'No account for {email}. They must sign in once first.')
        user.is_superuser = user.is_staff = not revoke
        user.save(update_fields=['is_superuser', 'is_staff'])
        verb = 'is no longer' if revoke else 'is now'
        self.stdout.write(self.style.SUCCESS(f'{user.email} {verb} an admin.'))
