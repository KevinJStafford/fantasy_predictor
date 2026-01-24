# Standard library imports
import os
from urllib.parse import urlparse

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

# Database configuration
# Handle both SQLite and PostgreSQL URLs
if DATABASE_URL.startswith('postgresql://') or DATABASE_URL.startswith('postgres://'):
    # PostgreSQL - use as-is
    app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
else:
    # SQLite - use as-is
    app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.json.compact = False
app.secret_key = SECRET_KEY.encode() if isinstance(SECRET_KEY, str) else SECRET_KEY

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
# In production, set CORS_ORIGINS environment variable
cors_origins = os.getenv('CORS_ORIGINS', '*')
if cors_origins != '*':
    # Parse comma-separated origins
    origins = [origin.strip() for origin in cors_origins.split(',')]
else:
    origins = '*'

CORS(app, origins=origins, supports_credentials=True)

