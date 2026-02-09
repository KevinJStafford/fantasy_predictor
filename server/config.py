# Standard library imports
import os
import warnings
from urllib.parse import urlparse

# Suppress SQLAlchemy deprecation warnings (not needed with SQLAlchemy 1.4, but keeping for safety)
warnings.filterwarnings('ignore', category=DeprecationWarning, module='sqlalchemy')

# Remote library imports
from flask import Flask
from flask_cors import CORS
from flask_migrate import Migrate
from flask_restful import Api
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import MetaData
from flask_bcrypt import Bcrypt

# Local imports

# Instantiate app, set attributes
app = Flask(__name__)

# Load environment variables
FLASK_ENV = os.getenv('FLASK_ENV', 'development')
SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///app.db')

# Render/Heroku often give postgres:// but SQLAlchemy 1.4+ expects postgresql://
if DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = 'postgresql://' + DATABASE_URL[len('postgres://'):]

# Database configuration
if DATABASE_URL.startswith('postgresql://'):
    app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
else:
    app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,
    'pool_recycle': 300,
}
app.json.compact = False
if not SECRET_KEY or (isinstance(SECRET_KEY, str) and not SECRET_KEY.strip()):
    if FLASK_ENV == 'production':
        raise ValueError('SECRET_KEY must be set in production (e.g. set in Render Environment)')
app.secret_key = SECRET_KEY.encode('utf-8') if isinstance(SECRET_KEY, str) else SECRET_KEY

# Session cookie configuration
# For cross-domain auth, we'll use token-based auth instead of cookies
# But if using cookies, set SESSION_COOKIE_DOMAIN to your base domain (e.g., .playfantasypredictor.com)
# Note: Cookies can only be shared on the same domain or subdomains
SESSION_COOKIE_DOMAIN = os.getenv('SESSION_COOKIE_DOMAIN', None)
if SESSION_COOKIE_DOMAIN:
    app.config['SESSION_COOKIE_DOMAIN'] = SESSION_COOKIE_DOMAIN
    app.config['SESSION_COOKIE_SAMESITE'] = 'None'
    app.config['SESSION_COOKIE_SECURE'] = True  # Required for SameSite=None

# Define metadata, instantiate db
metadata = MetaData(naming_convention={
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
})
db = SQLAlchemy(metadata=metadata)
migrate = Migrate(app, db)
db.init_app(app)

# Instantiate REST API
api = Api(app)
bcrypt = Bcrypt(app)

# CORS configuration
# With credentials (auth), the browser requires an explicit origin (not *).
# Set CORS_ORIGINS to your frontend URL(s), e.g. https://playfantasypredictor.com
cors_origins = (os.getenv('CORS_ORIGINS') or '').strip()
if cors_origins:
    origins = [o.strip() for o in cors_origins.split(',') if o.strip()]
else:
    origins = ['*']

# Store for after_request fallback (so error responses still get CORS)
app.config['CORS_ORIGINS_LIST'] = origins

CORS(app,
     origins=origins,
     supports_credentials=True,
     methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
     allow_headers=['Content-Type', 'Authorization'],
     intercept_exceptions=True)  # Add CORS headers to 5xx/4xx responses too

# Email (for password reset). Set MAIL_SERVER to enable sending.
app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER', '')
app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT', '587'))
app.config['MAIL_USE_TLS'] = os.getenv('MAIL_USE_TLS', 'true').lower() in ('1', 'true', 'yes')
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME', '')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD', '')
app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_DEFAULT_SENDER', '')  # e.g. "Fantasy Predictor <noreply@example.com>"
# Base URL for reset link in email (your frontend). e.g. https://your-app.vercel.app
app.config['RESET_PASSWORD_BASE_URL'] = os.getenv('RESET_PASSWORD_BASE_URL', '')
