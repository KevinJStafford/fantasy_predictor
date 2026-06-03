"""Smoke tests for GET /api/v1/leagues/<id>."""


def test_get_league_requires_auth(client):
    resp = client.get('/api/v1/leagues/1')
    assert resp.status_code == 401
    data = resp.get_json()
    assert 'error' in data


def test_get_league_not_found(client, member_setup):
    resp = client.get('/api/v1/leagues/99999', headers=member_setup['headers'])
    assert resp.status_code == 404
    assert 'not found' in (resp.get_json().get('error') or '').lower()


def test_get_league_forbidden_for_non_member(client, member_setup, outsider_setup):
    league_id = member_setup['league_id']
    resp = client.get(f'/api/v1/leagues/{league_id}', headers=outsider_setup['headers'])
    assert resp.status_code == 403
    assert 'member' in (resp.get_json().get('error') or '').lower()


def test_get_league_success(client, member_setup):
    league_id = member_setup['league_id']
    resp = client.get(f'/api/v1/leagues/{league_id}', headers=member_setup['headers'])
    assert resp.status_code == 200
    data = resp.get_json()
    league = data.get('league')
    assert league is not None
    assert league['id'] == league_id
    assert league['name'] == 'Bundesliga Smoke League'
    assert league['competition_slug'] == 'ger.1'
    assert league['leaderboard_scope'] == 'weekly'
    assert league['is_admin'] is True
    assert len(league.get('members') or []) == 1
    assert league['members'][0]['display_name'] == 'smoke_player'


def test_get_league_matches_list_entry_shape(client, member_setup):
    """Single-league payload should match one item from GET /api/v1/leagues."""
    league_id = member_setup['league_id']
    headers = member_setup['headers']

    single = client.get(f'/api/v1/leagues/{league_id}', headers=headers).get_json()['league']
    listed = client.get('/api/v1/leagues', headers=headers).get_json()['leagues']
    assert len(listed) == 1
    from_list = listed[0]

    for key in (
        'id',
        'name',
        'invite_code',
        'competition_slug',
        'leaderboard_scope',
        'is_admin',
        'members',
    ):
        assert single[key] == from_list[key], key
