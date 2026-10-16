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
        fields = ('email', 'fullName', 'institution', 'role')
        read_only_fields = fields


class SafeTokenRefreshSerializer(TokenRefreshSerializer):
    """A refresh token for a deleted account is a 401, not a 500."""

    def validate(self, attrs):
        try:
            return super().validate(attrs)
        except User.DoesNotExist:
            raise AuthenticationFailed('This account no longer exists.', code='user_not_found')


class ManagedUserSerializer(serializers.ModelSerializer):
    """One row of the admin's Users page."""

    fullName = serializers.CharField(source='full_name', read_only=True)
    isVerifier = serializers.BooleanField(source='is_verifier')
    reportCount = serializers.IntegerField(read_only=True)
    joinedAt = serializers.DateTimeField(source='date_joined', read_only=True)

    class Meta:
        model = User
        fields = ('id', 'email', 'fullName', 'institution', 'role', 'isVerifier', 'reportCount', 'joinedAt')
        read_only_fields = ('id', 'email', 'institution', 'role')
