from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenRefreshSerializer

from .models import User


class GoogleLoginSerializer(serializers.Serializer):
    id_token = serializers.CharField()


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class UserSerializer(serializers.ModelSerializer):
    fullName = serializers.CharField(source='full_name', read_only=True)

    class Meta:
        model = User
        fields = ('email', 'fullName', 'institution')
        read_only_fields = fields


class SafeTokenRefreshSerializer(TokenRefreshSerializer):
    """A refresh token for a deleted account is a 401, not a 500."""

    def validate(self, attrs):
        try:
            return super().validate(attrs)
        except User.DoesNotExist:
            raise AuthenticationFailed('This account no longer exists.', code='user_not_found')
