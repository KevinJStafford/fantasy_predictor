from sqlalchemy_serializer import SerializerMixin
from sqlalchemy.ext.associationproxy import association_proxy

from config import db, bcrypt

# Models go here!
class User(db.Model, SerializerMixin):
    __tablename__ = 'users'

    serialize_rules=('-password_hash', )

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String, nullable=False)
    email = db.Column(db.String, nullable=False)
    _password_hash = db.Column(db.String)
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    updated_at = db.Column(db.DateTime, server_default=db.func.now(), onupdate=db.func.now())

    # Relationships
    # predictions = db.relationship('Prediction', back_populates='user', cascade='all, delete-orphan')
    # games = association_proxy('predictions', 'game')

    @property
    def password_hash(self):
        return self._password_hash
    
    @password_hash.setter
    def password_hash(self, plain_text_password):
        byte_object = plain_text_password.encode('utf-8')
        encrypted_password_object = bcrypt.generate_password_hash(byte_object)
        hashed_password_string = encrypted_password_object.decode('utf-8')
        self._password_hash = hashed_password_string
        
    def authenticate(self, password_string):
        byte_object = password_string.encode('utf-8')
        return bcrypt.check_password_hash(self._password_hash, byte_object)
    
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


    def __repr__(self):
        return f'<Game {self.id}: {self.game_week_name}>'