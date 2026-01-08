#!/usr/bin/env python3

# Standard library imports

# Remote library imports
from flask import request, make_response, session
from flask_restful import Resource

# Local imports
from config import app, db, api
# Add your model imports
from models import User, Game, Prediction, Fixture

# Views go here!
class Users(Resource):
    def post(self):
        try:
            data = request.get_json()
            user = User(username=data['username'], email=data['email'], password_hash=data['password'])
            db.session.add(user)
            db.session.commit()
            session['user_id'] = user.id
            return make_response({'user': user.to_dict()}, 201)
        except Exception as e:
            db.session.rollback()
            return make_response({'error': str(e)}, 500)
    
api.add_resource(Users, '/api/v1/users')

class Fixtures(Resource):
    def get(self):
        fixtures = [f.to_dict() for f in Fixture.query.all()]
        if not fixtures:
            return make_response({"error": "No fixtures found"}, 404)
        else:
            return make_response(fixtures, 200)

api.add_resource(Fixtures, '/api/v1/fixtures')

class Games(Resource):
    def post(self):
        data = request.get_json()
        game = Game(game_week=data['game_week'], home_team=data['home_team'], home_team_score=data['home_team_score'], away_team=data['away_team'], away_team_score=data['away_team_score'])
    
@app.route('/api/v1/authorized')
def authorized():
    try:
        user = User.query.filter_by(id=session.get('user_id')).first()
        return make_response(user.to_dict(), 200)
    except:
        return make_response({"error": "User not found"}, 404)
    
@app.route('/api/v1/logout', methods=['DELETE'])
def logout():
    session['user_id'] = None
    return make_response('', 204)

@app.route('/api/v1/login', methods=['POST'])
def login():
    data = request.get_json()
    try:
        user = User.query.filter_by(username=data['username']).first()
        if user.authenticate(data['password']):
            session['user_id'] = user.id
            return make_response({'user': user.to_dict()}, 200)
        else:
            return make_response({'error': 'Password incorrect'}, 401)
    except:
        return make_response({'error': 'username incorrect'}, 401)
    

@app.route('/')
def index():
    return '<h1>Project Server</h1>'


if __name__ == '__main__':
    app.run(port=5555, debug=True)

