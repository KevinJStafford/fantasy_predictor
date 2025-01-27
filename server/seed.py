#!/usr/bin/env python3

# Standard library imports
from random import randint, choice as rc

# Remote library imports
from faker import Faker
from datetime import date

# Local imports
from app import app
from models import db, Game, Prediction, User, Fixture

with app.app_context():
    print("Deleting data...")
    Game.query.delete()
    Prediction.query.delete()
    User.query.delete()
    Fixture.query.delete()

    print("Creating fixtures...")
    f1 = Fixture(fixture_round = 18, fixture_date = date(2023, 12, 21), fixture_home_team = "Crystal Palace", fixture_away_team = "Brighton and Hove Albion")
    f2 = Fixture(fixture_round = 18, fixture_date = date(2023, 12, 22), fixture_home_team = "Aston Villa", fixture_away_team = "Sheffield United")
    f3 = Fixture(fixture_round = 18, fixture_date = date(2023, 12, 23), fixture_home_team = "West Ham", fixture_away_team = "Manchester United")
    f4 = Fixture(fixture_round = 18, fixture_date = date(2023, 12, 23), fixture_home_team = "Fulham", fixture_away_team = "Burnley")
    f5 = Fixture(fixture_round = 18, fixture_date = date(2023, 12, 23), fixture_home_team = "Luton", fixture_away_team = "Newcastle")
    f5 = Fixture(fixture_round = 18, fixture_date = date(2023, 12, 23), fixture_home_team = "Nottingham Forest", fixture_away_team = "Bournmouth")
    f6 = Fixture(fixture_round = 18, fixture_date = date(2023, 12, 23), fixture_home_team = "Tottenham Hotspurs", fixture_away_team = "Everton")
    f7 = Fixture(fixture_round = 18, fixture_date = date(2023, 12, 23), fixture_home_team = "Liverpool", fixture_away_team = "Arsenal")
    f8 = Fixture(fixture_round = 18, fixture_date = date(2023, 12, 24), fixture_home_team = "Wolverhampton Wanderers", fixture_away_team = "Chelsea")
    f9 = Fixture(fixture_round = 19, fixture_date = date(2023, 12, 26), fixture_home_team = "Newcastle", fixture_away_team = "Nottingham Forest")
    f10 = Fixture(fixture_round = 19, fixture_date = date(2023, 12, 26), fixture_home_team = "Bournemouth", fixture_away_team = "Fulham")
    f11 = Fixture(fixture_round = 19, fixture_date = date(2023, 12, 26), fixture_home_team = "Sheffield United", fixture_away_team = "Luton")
    f12 = Fixture(fixture_round = 19, fixture_date = date(2023, 12, 26), fixture_home_team = "Burnley", fixture_away_team = "Liverpool")
    f13 = Fixture(fixture_round = 19, fixture_date = date(2023, 12, 26), fixture_home_team = "Manchester United", fixture_away_team = "Aston Villa")
    f14 = Fixture(fixture_round = 19, fixture_date = date(2023, 12, 27), fixture_home_team = "Brentford", fixture_away_team = "Wolverhampton Wanderers")
    f15 = Fixture(fixture_round = 19, fixture_date = date(2023, 12, 27), fixture_home_team = "Chelsea", fixture_away_team = "Crystal Palace")
    f16 = Fixture(fixture_round = 19, fixture_date = date(2023, 12, 27), fixture_home_team = "Everton", fixture_away_team = "Manchester City")
    f17 = Fixture(fixture_round = 19, fixture_date = date(2023, 12, 28), fixture_home_team = "Brighton and Hove Albion", fixture_away_team = "Tottenham Hotspurs")
    f18 = Fixture(fixture_round = 19, fixture_date = date(2023, 12, 28), fixture_home_team = "Arsenal", fixture_away_team = "West Ham United")
    
    fixtures = [f1, f2, f3, f4, f5, f6, f7, f8, f9, f10, f11, f12, f13, f14, f15, f16, f17, f18]


    db.session.add_all(fixtures)
    db.session.commit()
# if __name__ == '__main__':
#     fake = Faker()
#     with app.app_context():
#         print("Starting seed...")
#         # Seed code goes here!
