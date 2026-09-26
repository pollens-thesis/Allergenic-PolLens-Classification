"""
Turn a PostgreSQL connection string (what Neon's dashboard hands out, e.g.
``postgresql://user:pass@ep-xyz.ap-southeast-1.aws.neon.tech/dbname?sslmode=require``)
into a Django DATABASES entry — one variable to paste instead of four.
"""

from urllib.parse import parse_qsl, unquote, urlsplit


def database_from_url(url):
    parts = urlsplit(url.strip())
    if parts.scheme not in ('postgres', 'postgresql'):
        raise ValueError('DATABASE_URL must start with postgresql:// or postgres://')
    name = unquote(parts.path.lstrip('/'))
    if not parts.hostname or not name:
        raise ValueError('DATABASE_URL needs a host and a database name.')

    # Query options (sslmode, channel_binding, ...) go straight to libpq.
    options = dict(parse_qsl(parts.query))
    options.setdefault('sslmode', 'require')

    config = {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': name,
        'USER': unquote(parts.username or 'postgres'),
        'PASSWORD': unquote(parts.password or ''),
        'HOST': parts.hostname,
        'PORT': str(parts.port or 5432),
        'OPTIONS': options,
        'CONN_MAX_AGE': 600,
        # A connection the server has since closed (Neon suspends idle
        # databases) is detected and replaced instead of failing the request.
        'CONN_HEALTH_CHECKS': True,
    }

    # Neon's "-pooler" hosts sit behind PgBouncer in transaction mode, which
    # can't keep server-side cursors or long-lived connections. Harmless to
    # tolerate, so a pooled address pasted by mistake still works.
    if '-pooler' in parts.hostname:
        config['CONN_MAX_AGE'] = 0
        config['CONN_HEALTH_CHECKS'] = False
        config['DISABLE_SERVER_SIDE_CURSORS'] = True

    return config
