import jwt
from django.conf import settings
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .access import is_allowed
from .models import User
from .serializers import GoogleLoginSerializer, LogoutSerializer, UserSerializer

NOT_ALLOWED_DETAIL = "This account isn't authorised to use PolLens. Ask the project team to add it."


def issue_session(email, institution, full_name=''):
    """
    Shared end of every sign-in: allowlist, get-or-create the user (one account
    per email, whichever provider was used), refresh the institution, and mint
    our JWT pair. Returns a Response.
    """
    email = email.strip().lower()
    if not is_allowed(email):
        return Response({'detail': NOT_ALLOWED_DETAIL}, status=status.HTTP_403_FORBIDDEN)

    full_name = (full_name or '').strip()[:255]
    user = User.objects.filter(email__iexact=email).first()
    if user is None:
        user = User.objects.create(email=email, institution=institution, full_name=full_name)
    else:
        changed = []
        if institution and user.institution != institution:
            user.institution = institution
            changed.append('institution')
        if full_name and user.full_name != full_name:
            user.full_name = full_name
            changed.append('full_name')
        if changed:
            user.save(update_fields=changed)

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


class GoogleLoginView(APIView):
    """
    POST /api/v1/auth/google/

    Exchanges a Google ID token (obtained client-side by the frontend) for
    our own JWT pair. There is no username/password login — this is the
    only way to obtain a token pair.
    """

    permission_classes = [AllowAny]
    throttle_scope = 'login'

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

        return issue_session(email, claims.get('hd', ''), claims.get('name', ''))


MICROSOFT_JWKS_URL = 'https://login.microsoftonline.com/common/discovery/v2.0/keys'
MICROSOFT_ISSUER = 'https://login.microsoftonline.com/{tid}/v2.0'
# The tenant Microsoft uses for personal (outlook.com, hotmail) accounts —
# rejected: only work/school accounts are accepted.
MICROSOFT_PERSONAL_TENANT = '9188040d-6c67-4c5b-b112-36a304b66dad'

_jwks_client = None


def _microsoft_signing_key(token):
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = jwt.PyJWKClient(MICROSOFT_JWKS_URL, cache_keys=True, lifespan=3600)
    return _jwks_client.get_signing_key_from_jwt(token).key


def verify_microsoft_id_token(token, client_id):
    """
    Verifies a Microsoft identity platform v2 ID token for a multitenant app:
    signature against Microsoft's published keys, audience = our client id,
    expiry, and an issuer that matches the token's own tenant (the documented
    way to validate multitenant tokens). Raises jwt.InvalidTokenError.
    """
    claims = jwt.decode(
        token,
        _microsoft_signing_key(token),
        algorithms=['RS256'],
        audience=client_id,
        options={'require': ['exp', 'iat', 'aud', 'iss', 'tid']},
    )
    tid = claims['tid']
    if claims['iss'] != MICROSOFT_ISSUER.format(tid=tid):
        raise jwt.InvalidIssuerError('Issuer does not match the token tenant.')
    if tid == MICROSOFT_PERSONAL_TENANT:
        raise jwt.InvalidTokenError('Personal Microsoft accounts are not accepted.')
    return claims


class MicrosoftLoginView(APIView):
    """
    POST /api/v1/auth/microsoft/  {"id_token": "..."}

    Same contract as GoogleLoginView, for Microsoft work/school accounts
    (e.g. up.edu.ph's Microsoft 365). Identity is `preferred_username` — the
    account's sign-in name, whose domain the tenant has verified — rather than
    the optional `email` claim, which a tenant admin can set to anything.
    """

    permission_classes = [AllowAny]
    throttle_scope = 'login'

    def post(self, request):
        serializer = GoogleLoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'detail': 'A Microsoft id_token is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not settings.MICROSOFT_CLIENT_ID:
            return Response(
                {'detail': 'Microsoft sign-in is not configured on the server.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            claims = verify_microsoft_id_token(
                serializer.validated_data['id_token'], settings.MICROSOFT_CLIENT_ID,
            )
        except (jwt.InvalidTokenError, jwt.PyJWKClientError):
            return Response(
                {'detail': 'Invalid or expired Microsoft ID token.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        email = (claims.get('preferred_username') or '').strip().lower()
        if '@' not in email:
            return Response(
                {'detail': 'Microsoft account has no sign-in email.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        return issue_session(email, email.rsplit('@', 1)[1], claims.get('name', ''))


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
