from flask import Flask, render_template, request, redirect, session, url_for, jsonify
from flask_socketio import SocketIO, emit
from flask_sqlalchemy import SQLAlchemy
from game_logic import GameManager
from user_auth import UserManager
from models import db, User
import os

app = Flask(__name__)
app.secret_key = 'super-secret-key'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
db.init_app(app)
socketio = SocketIO(app, cors_allowed_origins="*")

game_manager = GameManager()
user_manager = UserManager(db)

with app.app_context():
    db.create_all()

@app.route("/")
def index():
    if 'username' in session:
        return render_template("index.html")
    return redirect(url_for('login'))

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]
        if user_manager.verify_user(username, password):
            session['username'] = username
            return redirect(url_for('index'))
        return "Login failed", 401
    return render_template("login.html")

@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        data = request.get_json()
        if user_manager.register_user(data['username'], data['password']):
            return jsonify({"success": True})
        return jsonify({"success": False, "error": "帳號已存在"})
    return render_template("register.html")

@app.route("/logout")
def logout():
    session.pop('username', None)
    return redirect(url_for('login'))

@app.route("/partials/<name>")
def partial(name):
    try:
        return render_template(f"partials/{name}.html")
    except:
        return "Not found", 404

@socketio.on("place_stone")
def handle_place_stone(data):
    game_id = data["game_id"]
    x, y = data["x"], data["y"]
    color = data["color"]
    result = game_manager.place_stone(game_id, x, y, color)
    emit("update_board", result, broadcast=True)

@socketio.on("new_game")
def handle_new_game():
    game_id = game_manager.create_game()
    emit("game_created", {"game_id": game_id})

@socketio.on("reset_board")
def handle_reset_board(data):
    game_id = data["game_id"]
    result = game_manager.reset_game(game_id)
    emit("board_reset", result, broadcast=True)

if __name__ == "__main__":
    socketio.run(app, debug=True)