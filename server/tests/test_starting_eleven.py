"""Starting Eleven accounts keep their own headshots and lineup."""
import io
import json

from config import app, db
from models import League, LeagueMembership, LineupPlayer, User


JPEG = b'\xff\xd8\xff\xd9'


def _signup(client, email, password='password'):
    return client.post('/api/v1/starting-eleven/signup', json={
        'email': email,
        'password': password,
        'confirm_password': password,
    })


def _auth(resp):
    token = resp.get_json()['token']
    if isinstance(token, bytes):
        token = token.decode('utf-8')
    return {'Authorization': f'Bearer {token}'}


def _upload(client, headers, name='Keeper', filename='keeper.jpg'):
    return client.post(
        '/api/v1/starting-eleven/players',
        data={
            'images': (io.BytesIO(JPEG), filename),
            'names': json.dumps([name]),
        },
        headers=headers,
        content_type='multipart/form-data',
    )


def test_signup_does_not_join_a_fantasy_league(client):
    with app.app_context():
        owner = User(email='owner@smoke.test')
        owner.password_hash = 'password'
        db.session.add(owner)
        db.session.flush()
        league = League(name='Community', invite_code='COMM01', created_by=owner.id)
        db.session.add(league)
        db.session.flush()
        app.config['SIGNUP_LEAGUE_ID'] = league.id

    resp = _signup(client, 'eleven@smoke.test')
    assert resp.status_code == 201
    user_id = resp.get_json()['user']['id']

    with app.app_context():
        assert LeagueMembership.query.filter_by(user_id=user_id).count() == 0


def test_lineup_is_private_to_each_account(client):
    first = _auth(_signup(client, 'one@smoke.test'))
    second = _auth(_signup(client, 'two@smoke.test'))

    uploaded = _upload(client, first, name='Keeper')
    assert uploaded.status_code == 201
    player_id = uploaded.get_json()['players'][0]['id']
    image_path = uploaded.get_json()['players'][0]['image']

    saved = client.put('/api/v1/starting-eleven/lineup', json={
        'formation': '4-3-3',
        'assignments': {'gk': player_id, 'not-a-slot': player_id},
    }, headers=first)
    assert saved.status_code == 200
    assert saved.get_json()['assignments'] == {'gk': player_id}

    other = client.get('/api/v1/starting-eleven/lineup', headers=second)
    assert other.status_code == 200
    assert other.get_json()['players'] == []

    stolen = client.delete(f'/api/v1/starting-eleven/players/{player_id}', headers=second)
    assert stolen.status_code == 404

    image = client.get(image_path)
    assert image.status_code == 200
    assert image.data == JPEG

    with app.app_context():
        assert LineupPlayer.query.count() == 1


def test_upload_requires_login_and_stops_at_thirty(client):
    anon = client.get('/api/v1/starting-eleven/lineup')
    assert anon.status_code == 401

    headers = _auth(_signup(client, 'full@smoke.test'))
    for index in range(30):
        resp = _upload(client, headers, name=f'P{index}', filename=f'p{index}.jpg')
        assert resp.status_code == 201

    overflow = _upload(client, headers, name='Extra', filename='extra.jpg')
    assert overflow.status_code == 400
    assert b'30' in overflow.data
