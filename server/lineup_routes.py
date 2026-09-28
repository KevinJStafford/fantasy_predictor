"""Starting Eleven accounts, headshots, and pitch placements."""
import json
import secrets

from flask import request, make_response, session, Response

from config import db
from models import LineupPlayer, User, UserLineup

MAX_LINEUP_PLAYERS = 30
MAX_IMAGE_BYTES = 2 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp',
}
FORMATION_SLOTS = {
    '4-3-3': {'lw', 'st', 'rw', 'lcm', 'cm', 'rcm', 'lb', 'lcb', 'rcb', 'rb', 'gk'},
    '4-4-2': {'lst', 'rst', 'lm', 'lcm', 'rcm', 'rm', 'lb', 'lcb', 'rcb', 'rb', 'gk'},
    '4-2-3-1': {'st', 'lam', 'cam', 'ram', 'ldm', 'rdm', 'lb', 'lcb', 'rcb', 'rb', 'gk'},
    '3-5-2': {'lst', 'rst', 'lwb', 'lcm', 'cm', 'rcm', 'rwb', 'lcb', 'cb', 'rcb', 'gk'},
    '3-4-3': {'lw', 'st', 'rw', 'lm', 'lcm', 'rcm', 'rm', 'lcb', 'cb', 'rcb', 'gk'},
    '5-3-2': {'lst', 'rst', 'lcm', 'cm', 'rcm', 'lwb', 'lcb', 'cb', 'rcb', 'rwb', 'gk'},
}


def register_lineup_routes(app, get_current_user_id, get_active_user_by_id, get_active_user_by_email, generate_token):
    def _current_user():
        user_id = get_current_user_id()
        if not user_id:
            return None, make_response({'error': 'Not authenticated'}, 401)
        user = get_active_user_by_id(user_id)
        if not user:
            return None, make_response({'error': 'Not authenticated'}, 401)
        return user, None

    def _player_count(user_id):
        return LineupPlayer.query.filter_by(user_id=user_id).count()

    def _lineup_row(user_id):
        row = UserLineup.query.filter_by(user_id=user_id).first()
        if row:
            return row
        row = UserLineup(user_id=user_id, formation='4-3-3', assignments={})
        db.session.add(row)
        return row

    def _clean_assignments(formation, raw, owned_ids):
        slots = FORMATION_SLOTS.get(formation) or FORMATION_SLOTS['4-3-3']
        if not isinstance(raw, dict):
            return {}
        cleaned = {}
        for slot, player_id in raw.items():
            if slot not in slots:
                continue
            try:
                player_id = int(player_id)
            except (TypeError, ValueError):
                continue
            if player_id in owned_ids and player_id not in cleaned.values():
                cleaned[slot] = player_id
        return cleaned

    def _payload(user_id):
        players = (
            LineupPlayer.query.filter_by(user_id=user_id)
            .order_by(LineupPlayer.id.asc())
            .all()
        )
        owned_ids = {player.id for player in players}
        lineup = UserLineup.query.filter_by(user_id=user_id).first()
        formation = lineup.formation if lineup and lineup.formation in FORMATION_SLOTS else '4-3-3'
        assignments = _clean_assignments(
            formation,
            lineup.assignments if lineup else {},
            owned_ids,
        )
        return {
            'formation': formation,
            'assignments': assignments,
            'players': [
                {
                    'id': player.id,
                    'name': player.name,
                    'image': f'/api/v1/starting-eleven/images/{player.image_token}',
                }
                for player in players
            ],
        }

    def _name_from_filename(filename):
        base = (filename or '').rsplit('.', 1)[0].replace('_', ' ').replace('-', ' ').strip()
        return (base or 'Player')[:80]

    @app.route('/api/v1/starting-eleven/signup', methods=['POST'])
    def starting_eleven_signup():
        """Create an account that is not added to a fantasy league."""
        try:
            data = request.get_json() or {}
            email = (data.get('email') or '').strip().lower()
            password = (str(data.get('password')) if data.get('password') is not None else '').strip()
            confirm = (str(data.get('confirm_password')) if data.get('confirm_password') is not None else '').strip()
            if not email:
                return make_response({'error': 'Email is required'}, 400)
            if not password:
                return make_response({'error': 'Password is required'}, 400)
            if password != confirm:
                return make_response({'error': 'Password and confirmation do not match'}, 400)
            if get_active_user_by_email(email):
                return make_response({'error': 'An account with this email already exists'}, 400)
            user = User(email=email)
            user.password_hash = password
            db.session.add(user)
            db.session.commit()
            session['user_id'] = user.id
            token = generate_token(user.id)
            return make_response({
                'user': {'id': user.id, 'email': email, 'username': None},
                'token': token,
            }, 201)
        except Exception as exc:
            db.session.rollback()
            print(f"Starting Eleven signup failed: {exc}")
            return make_response({'error': 'Signup failed. Please try again.'}, 500)

    @app.route('/api/v1/starting-eleven/lineup', methods=['GET'])
    def get_starting_eleven_lineup():
        user, error = _current_user()
        if error:
            return error
        return make_response(_payload(user.id), 200)

    @app.route('/api/v1/starting-eleven/lineup', methods=['PUT'])
    def save_starting_eleven_lineup():
        user, error = _current_user()
        if error:
            return error
        data = request.get_json() or {}
        formation = data.get('formation') or '4-3-3'
        if formation not in FORMATION_SLOTS:
            return make_response({'error': 'Unknown formation'}, 400)
        owned_ids = {row.id for row in LineupPlayer.query.filter_by(user_id=user.id).all()}
        lineup = _lineup_row(user.id)
        lineup.formation = formation
        lineup.assignments = _clean_assignments(formation, data.get('assignments'), owned_ids)
        db.session.commit()
        return make_response(_payload(user.id), 200)

    @app.route('/api/v1/starting-eleven/players', methods=['POST'])
    def upload_starting_eleven_players():
        user, error = _current_user()
        if error:
            return error
        files = [item for item in request.files.getlist('images') if item and item.filename]
        if not files:
            return make_response({'error': 'Choose image files for the headshots.'}, 400)
        room = MAX_LINEUP_PLAYERS - _player_count(user.id)
        if room <= 0:
            return make_response({'error': f'You can keep up to {MAX_LINEUP_PLAYERS} headshots.'}, 400)
        try:
            parsed_names = json.loads(request.form.get('names') or '[]')
        except json.JSONDecodeError:
            parsed_names = []
        if not isinstance(parsed_names, list):
            parsed_names = []
        saved = 0
        skipped = 0
        for index, file in enumerate(files):
            if saved >= room:
                skipped += 1
                continue
            ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
            content_type = ALLOWED_IMAGE_TYPES.get(ext)
            if not content_type:
                skipped += 1
                continue
            file.seek(0, 2)
            size = file.tell()
            file.seek(0)
            if size <= 0 or size > MAX_IMAGE_BYTES:
                skipped += 1
                continue
            raw_name = parsed_names[index] if index < len(parsed_names) else ''
            name = str(raw_name or '').strip()[:80] or _name_from_filename(file.filename)
            db.session.add(LineupPlayer(
                user_id=user.id,
                name=name,
                image_bytes=file.read(),
                content_type=content_type,
                image_token=secrets.token_urlsafe(16),
            ))
            saved += 1
        if saved == 0:
            db.session.rollback()
            return make_response({'error': 'None of those images could be saved. Use JPEG, PNG, or WebP under 2MB.'}, 400)
        db.session.commit()
        body = _payload(user.id)
        if skipped:
            body['skipped'] = skipped
        return make_response(body, 201)

    @app.route('/api/v1/starting-eleven/players/<int:player_id>', methods=['PATCH'])
    def rename_starting_eleven_player(player_id):
        user, error = _current_user()
        if error:
            return error
        player = LineupPlayer.query.filter_by(id=player_id, user_id=user.id).first()
        if not player:
            return make_response({'error': 'Player not found'}, 404)
        data = request.get_json() or {}
        player.name = str(data.get('name') or '').strip()[:80]
        db.session.commit()
        return make_response({'id': player.id, 'name': player.name}, 200)

    @app.route('/api/v1/starting-eleven/players/<int:player_id>', methods=['DELETE'])
    def delete_starting_eleven_player(player_id):
        user, error = _current_user()
        if error:
            return error
        player = LineupPlayer.query.filter_by(id=player_id, user_id=user.id).first()
        if not player:
            return make_response({'error': 'Player not found'}, 404)
        lineup = UserLineup.query.filter_by(user_id=user.id).first()
        if lineup and isinstance(lineup.assignments, dict):
            kept = {}
            for slot, assigned in lineup.assignments.items():
                try:
                    if int(assigned) == player.id:
                        continue
                except (TypeError, ValueError):
                    continue
                kept[slot] = assigned
            lineup.assignments = kept
        db.session.delete(player)
        db.session.commit()
        return make_response(_payload(user.id), 200)

    @app.route('/api/v1/starting-eleven/players', methods=['DELETE'])
    def delete_all_starting_eleven_players():
        user, error = _current_user()
        if error:
            return error
        LineupPlayer.query.filter_by(user_id=user.id).delete()
        lineup = UserLineup.query.filter_by(user_id=user.id).first()
        if lineup:
            lineup.assignments = {}
        db.session.commit()
        return make_response(_payload(user.id), 200)

    @app.route('/api/v1/starting-eleven/images/<token>', methods=['GET'])
    def starting_eleven_image(token):
        player = LineupPlayer.query.filter_by(image_token=token).first()
        if not player or not player.image_bytes:
            return make_response({'error': 'Not found'}, 404)
        return Response(
            player.image_bytes,
            mimetype=player.content_type or 'image/jpeg',
            headers={'Cache-Control': 'private, max-age=86400'},
        )
