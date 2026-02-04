from sqlalchemy_serializer import SerializerMixin
from sqlalchemy.ext.associationproxy import association_proxy

from config import db, bcrypt

# Models go here!

class LeagueMembership(db.Model, SerializerMixin):
    """Association: user in a league with display name and role (admin vs player)."""
    __tablename__ = 'league_memberships'

    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), primary_key=True)
    league_id = db.Column(db.Integer, db.ForeignKey('leagues.id'), primary_key=True)
    display_name = db.Column(db.String, nullable=False)  # unique per league
    role = db.Column(db.String, nullable=False, default='player')  # 'admin' | 'player'
    joined_at = db.Column(db.DateTime, server_default=db.func.now())

    __table_args__ = (db.UniqueConstraint('league_id', 'display_name', name='uq_league_display_name'),)

    user = db.relationship('User', back_populates='league_memberships')
    league = db.relationship('League', back_populates='league_memberships')


class User(db.Model, SerializerMixin):
    __tablename__ = 'users'

    serialize_rules = ('-password_hash', '-reset_token', '-reset_token_expires', '-deleted_at',)

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String, nullable=True)  # optional; league display_name used per league
    email = db.Column(db.String, unique=True, nullable=False)
    _password_hash = db.Column(db.String(255))  # bcrypt hashes are 60 chars; 255 avoids truncation
    reset_token = db.Column(db.String, nullable=True)
    reset_token_expires = db.Column(db.DateTime, nullable=True)
    deleted_at = db.Column(db.DateTime, nullable=True)  # soft delete: when set, user is treated as deleted
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    updated_at = db.Column(db.DateTime, server_default=db.func.now(), onupdate=db.func.now())

    league_memberships = db.relationship('LeagueMembership', back_populates='user')
    leagues = association_proxy('league_memberships', 'league')

    @property
    def password_hash(self):
        return self._password_hash
    
    @password_hash.setter
    def password_hash(self, plain_text_password):
        if plain_text_password is None:
            self._password_hash = None
            return
        p = str(plain_text_password).strip()
        # Flask-Bcrypt in Python 3: decode hash to utf-8 before storing (hash is 60 chars)
        encrypted = bcrypt.generate_password_hash(p)
        self._password_hash = encrypted.decode('utf-8') if isinstance(encrypted, bytes) else encrypted
        
    def authenticate(self, password_string):
        if self._password_hash is None:
            return False
        if password_string is None:
            return False
        # Normalize hash: DB may return str or bytes (e.g. PostgreSQL)
        try:
            raw = self._password_hash
            if isinstance(raw, bytes):
                hash_str = raw.decode('utf-8')
            else:
                hash_str = str(raw) if raw else None
        except Exception:
            return False
        if not hash_str or not hash_str.startswith('$2'):
            return False
        p = str(password_string).strip()
        try:
            return bcrypt.check_password_hash(hash_str, p)
        except (RecursionError, TypeError, ValueError):
            return False
    
    def __repr__(self):
        return f'<User {self.id}: {self.username}>'

class Prediction(db.Model, SerializerMixin):
    __tablename__ = 'predictions'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    game_id = db.Column(db.Integer, db.ForeignKey('games.id'))
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    updated_at = db.Column(db.DateTime, server_default=db.func.now(), onupdate=db.func.now())

class Game(db.Model, SerializerMixin):
    __tablename__ = 'games'

    id = db.Column(db.Integer, primary_key=True)
    game_week_name = db.Column(db.String)
    game_week = db.Column(db.DateTime)
    home_team = db.Column(db.String)
    home_team_score = db.Column(db.Integer)
    away_team = db.Column(db.String)
    away_team_score = db.Column(db.Integer)
    game_result = db.Column(db.String)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    updated_at = db.Column(db.DateTime, server_default=db.func.now(), onupdate=db.func.now())

    # Relationships
    # predictions = db.relationship('Prediction', back_populates='game', cascade='all, delete-orphan')
    # users = association_proxy('predictions', 'user')

class Fixture(db.Model, SerializerMixin):
    __tablename__ = 'fixtures'

    id = db.Column(db.Integer, primary_key=True)
    fixture_round = db.Column(db.Integer)
    fixture_date = db.Column(db.DateTime)
    fixture_home_team = db.Column(db.String)
    fixture_away_team = db.Column(db.String)
    # Actual scores from completed matches
    actual_home_score = db.Column(db.Integer, nullable=True)
    actual_away_score = db.Column(db.Integer, nullable=True)
    is_completed = db.Column(db.Boolean, default=False)

    def __repr__(self):
        return f'<Fixture {self.id}: {self.fixture_home_team} vs {self.fixture_away_team}>'

class League(db.Model, SerializerMixin):
    __tablename__ = 'leagues'

    serialize_rules = ('-league_memberships.user.leagues', '-league_memberships.user._password_hash',)

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String, nullable=False)
    invite_code = db.Column(db.String, unique=True, nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    updated_at = db.Column(db.DateTime, server_default=db.func.now(), onupdate=db.func.now())

    # Relationships: members via LeagueMembership (each has display_name per league)
    league_memberships = db.relationship('LeagueMembership', back_populates='league')
    members = association_proxy('league_memberships', 'user')

    def to_dict(self, rules=None):
        """Custom to_dict: members include display_name from LeagueMembership"""
        data = {
            'id': self.id,
            'name': self.name,
            'invite_code': self.invite_code,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if hasattr(self, 'league_memberships') and self.league_memberships:
            data['members'] = [
                {
                    'id': lm.user.id,
                    'display_name': lm.display_name,
                    'email': lm.user.email,
                    'role': lm.role,
                    'created_at': lm.user.created_at.isoformat() if lm.user.created_at else None,
                }
                for lm in self.league_memberships
            ]
        else:
            data['members'] = []
        return data

    def __repr__(self):
        return f'<League {self.id}: {self.name}>'