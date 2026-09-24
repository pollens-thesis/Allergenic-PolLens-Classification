from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication

from .access import is_allowed


class AllowlistedJWTAuthentication(JWTAuthentication):
    """
    SimpleJWT authentication that also re-applies the sign-in allowlist
    (accounts.access) to every request, so a researcher removed from the
    list loses access at once instead of when their tokens run out.
    """

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if not is_allowed(user.email):
            raise AuthenticationFailed(
                "This account isn't authorised to use PolLens.", code='not_allowed',
            )
        return user
