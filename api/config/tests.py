from django.test import SimpleTestCase

from .dburl import database_from_url


class DatabaseUrlTests(SimpleTestCase):
    def test_parses_a_neon_style_connection_string(self):
        db = database_from_url(
            'postgresql://appuser:s3cret@ep-cool-sky-123.ap-southeast-1.aws.neon.tech/pollens'
            '?sslmode=require&channel_binding=require'
        )

        self.assertEqual(db['ENGINE'], 'django.db.backends.postgresql')
        self.assertEqual(db['NAME'], 'pollens')
        self.assertEqual(db['USER'], 'appuser')
        self.assertEqual(db['PASSWORD'], 's3cret')
        self.assertEqual(db['HOST'], 'ep-cool-sky-123.ap-southeast-1.aws.neon.tech')
        self.assertEqual(db['PORT'], '5432')
        self.assertEqual(db['OPTIONS'], {'sslmode': 'require', 'channel_binding': 'require'})
        self.assertEqual(db['CONN_MAX_AGE'], 600)
        self.assertTrue(db['CONN_HEALTH_CHECKS'])

    def test_percent_encoded_credentials_are_decoded(self):
        db = database_from_url('postgres://me%40x:p%40ss%2Fw%3Ard@db.example.com:6543/my%20db')

        self.assertEqual(db['USER'], 'me@x')
        self.assertEqual(db['PASSWORD'], 'p@ss/w:rd')
        self.assertEqual(db['PORT'], '6543')
        self.assertEqual(db['NAME'], 'my db')

    def test_ssl_is_required_unless_the_url_says_otherwise(self):
        self.assertEqual(database_from_url('postgresql://u:p@h/d')['OPTIONS']['sslmode'], 'require')
        self.assertEqual(
            database_from_url('postgresql://u:p@localhost/d?sslmode=disable')['OPTIONS']['sslmode'],
            'disable',
        )

    def test_pooled_host_disables_persistent_connections(self):
        db = database_from_url('postgresql://u:p@ep-x-pooler.ap-southeast-1.aws.neon.tech/d')

        self.assertEqual(db['CONN_MAX_AGE'], 0)
        self.assertTrue(db['DISABLE_SERVER_SIDE_CURSORS'])
        self.assertFalse(db['CONN_HEALTH_CHECKS'])

    def test_rejects_other_schemes_and_missing_parts(self):
        for bad in ('mysql://u:p@h/d', 'postgresql://u:p@h/', 'postgresql:///d', 'not a url'):
            with self.assertRaises(ValueError, msg=bad):
                database_from_url(bad)
