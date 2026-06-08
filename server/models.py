from sqlalchemy_serializer import SerializerMixin
from sqlalchemy.ext.associationproxy import association_proxy

from config import db, bcrypt

# Models go here!

class LeagueMembership(db.Model, SerializerMixin):
    """Association: user in a league with display name and role (admin vs player)."""
    __tablename__ = 'league_memberships'

    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), primary_key=True)
    league_id = db.Column(db.Integer, db.ForeignKey('leagues.id', ondelete='CASCADE'), primary_key=True)
    display_name = db.Column(db.String, nullable=False)  # unique per league
    role = db.Column(db.String, nullable=False, default='player')  # 'admin' | 'player'
    joined_at = db.Column(db.DateTime, server_default=db.func.now())
    # Optional backfilled standings (e.g. from Google Sheet); when set, leaderboard uses these
    backfill_wins = db.Column(db.Integer, nullable=True)
    backfill_draws = db.Column(db.Integer, nullable=True)
    backfill_losses = db.Column(db.Integer, nullable=True)
    backfill_points = db.Column(db.Integer, nullable=True)
    notify_missing_predictions = db.Column(db.Boolean, nullable=False, default=False)  # email when fixtures in <24h and no predictions saved
    last_missing_predictions_round = db.Column(db.Integer, nullable=True)  # last round we sent a reminder for (send only once per round)

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
    avatar_url = db.Column(db.String, nullable=True)  # profile picture path, e.g. /uploads/avatars/123_abc.jpg
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
    # Competition/league: e.g. eng.1 (EPL), esp.1 (La Liga), fra.1, ger.1, usa.1, fifa.world (World Cup). Null = legacy EPL.
    competition_slug = db.Column(db.String, nullable=True, index=True)
    # External API id (e.g. ESPN event id) for deduplication when syncing
    external_id = db.Column(db.String, nullable=True, index=True)
    # Actual scores from completed matches
    actual_home_score = db.Column(db.Integer, nullable=True)
    actual_away_score = db.Column(db.Integer, nullable=True)
    is_completed = db.Column(db.Boolean, default=False)
    # When True, fixture sync will not overwrite fixture_round.
    manual_round_override = db.Column(db.Boolean, nullable=False, default=False)

    def __repr__(self):
        return f'<Fixture {self.id}: {self.fixture_home_team} vs {self.fixture_away_team}>'

class LeagueWeekWinner(db.Model, SerializerMixin):
    """Records which member(s) won a given round in a league (for weekly leaderboard). Ties = multiple rows."""
    __tablename__ = 'league_week_winners'

    league_id = db.Column(db.Integer, db.ForeignKey('leagues.id', ondelete='CASCADE'), primary_key=True)
    fixture_round = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), primary_key=True)

    league = db.relationship('League', back_populates='week_winners')
    user = db.relationship('User', backref=db.backref('league_week_wins', lazy='dynamic'))


class TournamentEdition(db.Model, SerializerMixin):
    """A specific tournament instance (e.g. FIFA World Cup 2026) for bracket challenges."""
    __tablename__ = 'tournament_editions'

    id = db.Column(db.Integer, primary_key=True)
    competition_slug = db.Column(db.String, nullable=False)
    year = db.Column(db.Integer, nullable=False)
    slug = db.Column(db.String, unique=True, nullable=False)  # e.g. fifa-world-2026
    name = db.Column(db.String, nullable=False)
    num_groups = db.Column(db.Integer, nullable=False)
    third_place_advance = db.Column(db.Integer, nullable=False)
    bracket_lock_at = db.Column(db.DateTime, nullable=True)
    is_active = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    group_teams = db.relationship(
        'TournamentGroupTeam', back_populates='edition', cascade='all, delete-orphan', lazy='dynamic'
    )
    bracket_entries = db.relationship(
        'BracketEntry', back_populates='edition', cascade='all, delete-orphan', lazy='dynamic'
    )

    __table_args__ = (
        db.UniqueConstraint('competition_slug', 'year', name='uq_tournament_edition_comp_year'),
    )

    def to_public_dict(self, submission_count=0):
        from datetime import datetime, timezone

        lock_at = self.bracket_lock_at
        is_locked = False
        if lock_at is not None:
            ref = datetime.now(timezone.utc).replace(tzinfo=None)
            lock_naive = lock_at.replace(tzinfo=None) if getattr(lock_at, 'tzinfo', None) else lock_at
            is_locked = ref >= lock_naive
        return {
            'slug': self.slug,
            'name': self.name,
            'competition_slug': self.competition_slug,
            'year': self.year,
            'num_groups': self.num_groups,
            'third_place_advance': self.third_place_advance,
            'bracket_lock_at': lock_at.isoformat() if lock_at else None,
            'is_active': self.is_active,
            'is_locked': is_locked,
            'submission_count': submission_count,
        }


class TournamentGroupTeam(db.Model, SerializerMixin):
    """Official group draw: which teams belong to each group."""
    __tablename__ = 'tournament_group_teams'

    id = db.Column(db.Integer, primary_key=True)
    edition_id = db.Column(db.Integer, db.ForeignKey('tournament_editions.id', ondelete='CASCADE'), nullable=False)
    group_key = db.Column(db.String(2), nullable=False)
    team_name = db.Column(db.String, nullable=False)
    fifa_ranking = db.Column(db.Integer, nullable=True)

    edition = db.relationship('TournamentEdition', back_populates='group_teams')

    __table_args__ = (
        db.UniqueConstraint('edition_id', 'group_key', 'team_name', name='uq_tournament_group_team'),
    )


class BracketEntry(db.Model, SerializerMixin):
    """One user's bracket submission for a tournament edition (solo play; leagues filter these)."""
    __tablename__ = 'bracket_entries'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    edition_id = db.Column(db.Integer, db.ForeignKey('tournament_editions.id', ondelete='CASCADE'), nullable=False)
    status = db.Column(db.String, nullable=False, default='draft')  # draft | submitted | locked
    champion_pick = db.Column(db.String, nullable=True)
    group_points = db.Column(db.Integer, nullable=False, default=0)
    bracket_points = db.Column(db.Integer, nullable=False, default=0)
    total_points = db.Column(db.Integer, nullable=False, default=0)
    submitted_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    updated_at = db.Column(db.DateTime, server_default=db.func.now(), onupdate=db.func.now())

    user = db.relationship('User', backref=db.backref('bracket_entries', lazy='dynamic'))
    edition = db.relationship('TournamentEdition', back_populates='bracket_entries')
    group_predictions = db.relationship(
        'GroupPrediction', back_populates='entry', cascade='all, delete-orphan', lazy='dynamic'
    )
    bracket_picks = db.relationship(
        'BracketPick', back_populates='entry', cascade='all, delete-orphan', lazy='dynamic'
    )

    __table_args__ = (
        db.UniqueConstraint('user_id', 'edition_id', name='uq_bracket_entry_user_edition'),
    )


class GroupPrediction(db.Model, SerializerMixin):
    """Predicted top 3 in a group with points, GD, and goals scored."""
    __tablename__ = 'group_predictions'

    id = db.Column(db.Integer, primary_key=True)
    bracket_entry_id = db.Column(db.Integer, db.ForeignKey('bracket_entries.id', ondelete='CASCADE'), nullable=False)
    group_key = db.Column(db.String(2), nullable=False)
    winner_team = db.Column(db.String, nullable=True)
    winner_points = db.Column(db.Integer, nullable=True)
    winner_goal_diff = db.Column(db.Integer, nullable=True)
    winner_goals_scored = db.Column(db.Integer, nullable=True)
    runner_up_1_team = db.Column(db.String, nullable=True)
    runner_up_1_points = db.Column(db.Integer, nullable=True)
    runner_up_1_goal_diff = db.Column(db.Integer, nullable=True)
    runner_up_1_goals_scored = db.Column(db.Integer, nullable=True)
    runner_up_2_team = db.Column(db.String, nullable=True)
    runner_up_2_points = db.Column(db.Integer, nullable=True)
    runner_up_2_goal_diff = db.Column(db.Integer, nullable=True)
    runner_up_2_goals_scored = db.Column(db.Integer, nullable=True)

    entry = db.relationship('BracketEntry', back_populates='group_predictions')

    __table_args__ = (
        db.UniqueConstraint('bracket_entry_id', 'group_key', name='uq_group_prediction_entry_group'),
    )


class BracketPick(db.Model, SerializerMixin):
    """Knockout-round winner pick for a bracket entry."""
    __tablename__ = 'bracket_picks'

    id = db.Column(db.Integer, primary_key=True)
    bracket_entry_id = db.Column(db.Integer, db.ForeignKey('bracket_entries.id', ondelete='CASCADE'), nullable=False)
    match_key = db.Column(db.String, nullable=False)  # e.g. r32-M73
    picked_team = db.Column(db.String, nullable=False)
    is_correct = db.Column(db.Boolean, nullable=True)
    points_earned = db.Column(db.Integer, nullable=True)

    entry = db.relationship('BracketEntry', back_populates='bracket_picks')

    __table_args__ = (
        db.UniqueConstraint('bracket_entry_id', 'match_key', name='uq_bracket_pick_entry_match'),
    )


class League(db.Model, SerializerMixin):
    __tablename__ = 'leagues'

    serialize_rules = ('-league_memberships.user.leagues', '-league_memberships.user._password_hash',)

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String, nullable=False)
    invite_code = db.Column(db.String, unique=True, nullable=False)
    is_open = db.Column(db.Boolean, nullable=False, default=False)  # True = anyone can find and join; False = invite only
    leaderboard_scope = db.Column(db.String, nullable=False, default='full_season')  # 'full_season' | 'weekly'
    # Real-world competition (e.g. eng.1, esp.1, fifa.world) this league predicts; null = legacy EPL
    competition_slug = db.Column(db.String, nullable=True)
    # score_prediction (default) | knockout_bracket
    format = db.Column(db.String, nullable=False, default='score_prediction')
    # For knockout_bracket leagues: which tournament edition members compare brackets on
    edition_id = db.Column(db.Integer, db.ForeignKey('tournament_editions.id', ondelete='SET NULL'), nullable=True)
    # Enable "Ask AI" score suggestions for this league (can be pay-gated later)
    ai_predictions_enabled = db.Column(db.Boolean, nullable=False, default=False)
    # When set, leaderboard only counts fixtures/games on or after this time (new season in same league).
    season_started_at = db.Column(db.DateTime, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    updated_at = db.Column(db.DateTime, server_default=db.func.now(), onupdate=db.func.now())

    edition = db.relationship('TournamentEdition', backref=db.backref('leagues', lazy='dynamic'))

    # Relationships: members via LeagueMembership (each has display_name per league)
    league_memberships = db.relationship(
        'LeagueMembership', back_populates='league', cascade='all, delete-orphan'
    )
    week_winners = db.relationship(
        'LeagueWeekWinner', back_populates='league', cascade='all, delete-orphan', lazy='dynamic'
    )
    members = association_proxy('league_memberships', 'user')

    def to_dict(self, rules=None):
        """Custom to_dict: members include display_name from LeagueMembership"""
        data = {
            'id': self.id,
            'name': self.name,
            'invite_code': self.invite_code,
            'is_open': getattr(self, 'is_open', False),
            'leaderboard_scope': getattr(self, 'leaderboard_scope', 'full_season'),
            'competition_slug': getattr(self, 'competition_slug', None),
            'format': getattr(self, 'format', 'score_prediction'),
            'edition_id': getattr(self, 'edition_id', None),
            'ai_predictions_enabled': getattr(self, 'ai_predictions_enabled', False),
            'season_started_at': self.season_started_at.isoformat() if getattr(self, 'season_started_at', None) else None,
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
                    'notify_missing_predictions': getattr(lm, 'notify_missing_predictions', False),
                }
                for lm in self.league_memberships
            ]
        else:
            data['members'] = []
        return data

    def __repr__(self):
        return f'<League {self.id}: {self.name}>'