from django.conf import settings
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User
from .serializers import GoogleLoginSerializer, LogoutSerializer, UserSerializer


class GoogleLoginView(APIView):
    """
    POST /api/v1/auth/google/

    Exchanges a Google ID token (obtained client-side by the frontend) for
    our own JWT pair. There is no username/password login — this is the
    only way to obtain a token pair.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = GoogleLoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'detail': 'A Google id_token is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        token = serializer.validated_data['id_token']

        if not settings.GOOGLE_OAUTH_CLIENT_ID:
            return Response(
                {'detail': 'Google OAuth is not configured on the server.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            claims = google_id_token.verify_oauth2_token(
                token, google_requests.Request(), settings.GOOGLE_OAUTH_CLIENT_ID,
            )
        except ValueError:
            return Response(
                {'detail': 'Invalid or expired Google ID token.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        email = claims.get('email')
        if not email or not claims.get('email_verified'):
            return Response(
                {'detail': 'Google account has no verified email.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        institution = claims.get('hd', '')

        user, created = User.objects.get_or_create(
            email=email,
            defaults={'institution': institution},
        )
        if not created and institution and user.institution != institution:
            user.institution = institution
            user.save(update_fields=['institution'])

        if not user.is_active:
            return Response(
                {'detail': 'This account is inactive.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        refresh = RefreshToken.for_user(user)
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        })


class LogoutView(APIView):
    """
    POST /api/v1/auth/logout/

    Blacklists the given refresh token. Requires a valid access token —
    logout only ever invalidates the session presenting it.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'detail': 'A refresh token is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            RefreshToken(serializer.validated_data['refresh']).blacklist()
        except TokenError:
            return Response(
                {'detail': 'Invalid or expired refresh token.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        return Response({'detail': 'Successfully logged out.'})


class MeView(APIView):
    """
    GET /api/v1/auth/me/

    Returns the signed-in user's email and institution.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)
