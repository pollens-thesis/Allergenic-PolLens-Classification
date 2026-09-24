import time
from unittest.mock import patch

import jwt as pyjwt
from cryptography.hazmat.primitives.asymmetric import rsa
from django.test import override_settings

from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from .access import is_allowed
from .models import User

GOOGLE_CLAIMS = {
    'email': 'researcher@up.edu.ph',
    'email_verified': True,
    'hd': 'up.edu.ph',
}


class GoogleLoginViewTests(APITestCase):
    url = '/api/v1/auth/google/'

    @patch('accounts.views.google_id_token.verify_oauth2_token')
    def test_creates_user_and_returns_token_pair(self, mock_verify):
        mock_verify.return_value = dict(GOOGLE_CLAIMS)

        response = self.client.post(self.url, {'id_token': 'fake'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        user = User.objects.get(email='researcher@up.edu.ph')
        self.assertEqual(user.institution, 'up.edu.ph')

    @patch('accounts.views.google_id_token.verify_oauth2_token')
    def test_invalid_token_returns_401(self, mock_verify):
        mock_verify.side_effect = ValueError('bad token')

        response = self.client.post(self.url, {'id_token': 'bad'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data['detail'], 'Invalid or expired Google ID token.')

    @patch('accounts.views.google_id_token.verify_oauth2_token')
    def test_unverified_email_returns_401(self, mock_verify):
        mock_verify.return_value = {**GOOGLE_CLAIMS, 'email_verified': False}

        response = self.client.post(self.url, {'id_token': 'fake'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch('accounts.views.google_id_token.verify_oauth2_token')
    def test_inactive_user_returns_403(self, mock_verify):
        User.objects.create(
            email='researcher@up.edu.ph', institution='up.edu.ph', is_active=False,
        )
        mock_verify.return_value = dict(GOOGLE_CLAIMS)

        response = self.client.post(self.url, {'id_token': 'fake'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @patch('accounts.views.google_id_token.verify_oauth2_token')
    def test_institution_refreshed_on_existing_user(self, mock_verify):
        user = User.objects.create(email='researcher@up.edu.ph', institution='old.edu.ph')
        mock_verify.return_value = dict(GOOGLE_CLAIMS)

        self.client.post(self.url, {'id_token': 'fake'}, format='json')

        user.refresh_from_db()
        self.assertEqual(user.institution, 'up.edu.ph')

    def test_missing_id_token_returns_400(self):
        response = self.client.post(self.url, {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['detail'], 'A Google id_token is required.')


class MeViewTests(APITestCase):
    url = '/api/v1/auth/me/'

    def test_requires_authentication(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_returns_email_and_institution(self):
        user = User.objects.create(email='researcher@up.edu.ph', institution='up.edu.ph')
        self.client.force_authenticate(user=user)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data,
            {'email': 'researcher@up.edu.ph', 'fullName': '', 'institution': 'up.edu.ph'},
        )


class LogoutViewTests(APITestCase):
    url = '/api/v1/auth/logout/'

    def setUp(self):
        self.user = User.objects.create(email='researcher@up.edu.ph', institution='up.edu.ph')

    def test_requires_authentication(self):
        response = self.client.post(self.url, {'refresh': 'whatever'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_blacklists_refresh_token(self):
        refresh = RefreshToken.for_user(self.user)
        self.client.force_authenticate(user=self.user)

        response = self.client.post(self.url, {'refresh': str(refresh)}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {'detail': 'Successfully logged out.'})

        # The blacklisted refresh token can no longer mint a new access token.
        refresh_response = self.client.post(
            '/api/v1/auth/token/refresh/', {'refresh': str(refresh)}, format='json',
        )
        self.assertEqual(refresh_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_missing_refresh_returns_400(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(self.url, {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_refresh_returns_401(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(self.url, {'refresh': 'not-a-token'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class HealthzTests(APITestCase):
    def test_health_check_needs_no_auth(self):
        response = self.client.get('/healthz/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok'})


class AllowlistTests(APITestCase):
    @override_settings(SIGNIN_ALLOWED_DOMAINS=['up.edu.ph', 'mseuf.edu.ph'], SIGNIN_ALLOWED_EMAILS=['someone@gmail.com'])
    def test_domains_subdomains_and_named_emails(self):
        self.assertTrue(is_allowed('a@up.edu.ph'))
        self.assertTrue(is_allowed('A@UP.EDU.PH'))
        self.assertTrue(is_allowed('b@student.mseuf.edu.ph'))
        self.assertTrue(is_allowed('someone@gmail.com'))
        self.assertFalse(is_allowed('c@notup.edu.ph'))  # suffix without a dot boundary
        self.assertFalse(is_allowed('d@up.edu.ph.evil.com'))
        self.assertFalse(is_allowed('other@gmail.com'))
        self.assertFalse(is_allowed(''))

    @override_settings(SIGNIN_ALLOWED_DOMAINS=[], SIGNIN_ALLOWED_EMAILS=[])
    def test_empty_lists_admit_nobody(self):
        self.assertFalse(is_allowed('a@up.edu.ph'))

    @override_settings(GOOGLE_OAUTH_CLIENT_ID='client-id', SIGNIN_ALLOWED_DOMAINS=['up.edu.ph'], SIGNIN_ALLOWED_EMAILS=[])
    @patch('accounts.views.google_id_token.verify_oauth2_token')
    def test_google_login_outside_allowlist_is_403_and_creates_nobody(self, mock_verify):
        mock_verify.return_value = {**GOOGLE_CLAIMS, 'email': 'stranger@gmail.com'}

        response = self.client.post('/api/v1/auth/google/', {'id_token': 'x'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(User.objects.filter(email='stranger@gmail.com').exists())

    def test_removed_user_is_rejected_on_the_next_request(self):
        user = User.objects.create(email='researcher@up.edu.ph', institution='up.edu.ph')
        token = str(RefreshToken.for_user(user).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        self.assertEqual(self.client.get('/api/v1/auth/me/').status_code, status.HTTP_200_OK)
        with override_settings(SIGNIN_ALLOWED_DOMAINS=['mseuf.edu.ph'], SIGNIN_ALLOWED_EMAILS=[]):
            self.assertEqual(
                self.client.get('/api/v1/auth/me/').status_code, status.HTTP_401_UNAUTHORIZED,
            )


MS_CLIENT_ID = '11111111-2222-3333-4444-555555555555'
MS_TENANT = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
_MS_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


def make_microsoft_token(**overrides):
    now = int(time.time())
    claims = {
        'aud': MS_CLIENT_ID,
        'iss': f'https://login.microsoftonline.com/{MS_TENANT}/v2.0',
        'tid': MS_TENANT,
        'iat': now,
        'exp': now + 600,
        'preferred_username': 'Researcher@UP.edu.ph',
    }
    claims.update(overrides)
    claims = {k: v for k, v in claims.items() if v is not None}
    return pyjwt.encode(claims, _MS_KEY, algorithm='RS256')


@override_settings(MICROSOFT_CLIENT_ID=MS_CLIENT_ID, SIGNIN_ALLOWED_DOMAINS=['up.edu.ph'], SIGNIN_ALLOWED_EMAILS=[])
@patch('accounts.views._microsoft_signing_key', lambda token: _MS_KEY.public_key())
class MicrosoftLoginViewTests(APITestCase):
    url = '/api/v1/auth/microsoft/'

    def post(self, token):
        return self.client.post(self.url, {'id_token': token}, format='json')

    def test_valid_token_signs_in_and_uses_the_upn_domain_as_institution(self):
        response = self.post(make_microsoft_token())

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(set(response.data), {'access', 'refresh'})
        user = User.objects.get(email='researcher@up.edu.ph')
        self.assertEqual(user.institution, 'up.edu.ph')

    def test_same_email_as_an_existing_google_user_reuses_the_account(self):
        User.objects.create(email='researcher@up.edu.ph', institution='up.edu.ph')

        self.post(make_microsoft_token())

        self.assertEqual(User.objects.filter(email__iexact='researcher@up.edu.ph').count(), 1)

    def test_wrong_audience_is_401(self):
        self.assertEqual(self.post(make_microsoft_token(aud='someone-else')).status_code, 401)

    def test_issuer_from_another_tenant_is_401(self):
        token = make_microsoft_token(iss='https://login.microsoftonline.com/ffffffff-0000-0000-0000-000000000000/v2.0')
        self.assertEqual(self.post(token).status_code, 401)

    def test_personal_microsoft_account_is_401(self):
        personal = '9188040d-6c67-4c5b-b112-36a304b66dad'
        token = make_microsoft_token(tid=personal, iss=f'https://login.microsoftonline.com/{personal}/v2.0')
        self.assertEqual(self.post(token).status_code, 401)

    def test_expired_token_is_401(self):
        past = int(time.time()) - 3600
        self.assertEqual(self.post(make_microsoft_token(iat=past - 600, exp=past)).status_code, 401)

    def test_account_outside_allowlist_is_403(self):
        response = self.post(make_microsoft_token(preferred_username='someone@other.edu'))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_missing_token_is_400(self):
        self.assertEqual(self.client.post(self.url, {}, format='json').status_code, 400)

    @override_settings(MICROSOFT_CLIENT_ID='')
    def test_unconfigured_is_503(self):
        self.assertEqual(self.post(make_microsoft_token()).status_code, 503)


@override_settings(GOOGLE_OAUTH_CLIENT_ID='client-id', SIGNIN_ALLOWED_DOMAINS=['up.edu.ph'], SIGNIN_ALLOWED_EMAILS=[])
class AccountNameTests(APITestCase):
    @patch('accounts.views.google_id_token.verify_oauth2_token')
    def test_name_is_stored_refreshed_and_returned_by_me(self, mock_verify):
        mock_verify.return_value = {**GOOGLE_CLAIMS, 'name': 'Juan Dela Cruz'}
        self.client.post('/api/v1/auth/google/', {'id_token': 'x'}, format='json')
        user = User.objects.get(email='researcher@up.edu.ph')
        self.assertEqual(user.full_name, 'Juan Dela Cruz')

        mock_verify.return_value = {**GOOGLE_CLAIMS, 'name': 'Juan P. Dela Cruz'}
        self.client.post('/api/v1/auth/google/', {'id_token': 'x'}, format='json')
        user.refresh_from_db()
        self.assertEqual(user.full_name, 'Juan P. Dela Cruz')

        # A token without a name never erases the one we have.
        mock_verify.return_value = dict(GOOGLE_CLAIMS)
        self.client.post('/api/v1/auth/google/', {'id_token': 'x'}, format='json')
        user.refresh_from_db()
        self.assertEqual(user.full_name, 'Juan P. Dela Cruz')

        self.client.force_authenticate(user=user)
        self.assertEqual(self.client.get('/api/v1/auth/me/').data['fullName'], 'Juan P. Dela Cruz')


@override_settings(MICROSOFT_CLIENT_ID=MS_CLIENT_ID, SIGNIN_ALLOWED_DOMAINS=['up.edu.ph'], SIGNIN_ALLOWED_EMAILS=[])
@patch('accounts.views._microsoft_signing_key', lambda token: _MS_KEY.public_key())
class MicrosoftNameTests(APITestCase):
    def test_microsoft_name_claim_is_stored(self):
        self.client.post(
            '/api/v1/auth/microsoft/', {'id_token': make_microsoft_token(name='Maria Santos')}, format='json',
        )
        self.assertEqual(User.objects.get(email='researcher@up.edu.ph').full_name, 'Maria Santos')
