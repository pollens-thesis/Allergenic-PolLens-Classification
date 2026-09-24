from rest_framework import serializers

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
