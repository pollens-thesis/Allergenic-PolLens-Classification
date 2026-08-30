from unittest.mock import patch

from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

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
            response.data, {'email': 'researcher@up.edu.ph', 'institution': 'up.edu.ph'},
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
