from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

db = SQLAlchemy()

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)

class GameRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    moves = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def get_moves(self):
        return json.loads(self.moves)

#test