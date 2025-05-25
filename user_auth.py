import hashlib
from models import User

class UserManager:
    def __init__(self, database):
        self.db = database

    def hash_password(self, password):
        return hashlib.sha256(password.encode()).hexdigest()

    def verify_user(self, username, password):
        user = User.query.filter_by(username=username).first()
        if user:
            return user.password_hash == self.hash_password(password)
        return False

    def register_user(self, username, password):
        if User.query.filter_by(username=username).first():
            return False
        user = User(username=username, password_hash=self.hash_password(password))
        self.db.session.add(user)
        self.db.session.commit()
        return True
