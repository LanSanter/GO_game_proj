from flask import Flask, render_template, request, redirect, session, url_for, jsonify
from flask_socketio import SocketIO, emit
from flask_sqlalchemy import SQLAlchemy
from game_logic import GameManager, Game
from user_auth import UserManager
from models import db, User, GameRecord
import os, json
from functools import wraps
from flask import (
    Flask, render_template, redirect,
    url_for, request, session, jsonify
)
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
            return redirect(url_for("lobby"))
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

@app.route("/lobby")
def lobby():
    return render_template("lobby.html")

@app.route("/partials/<name>")
def partial(name):
    try:
        return render_template(f"partials/{name}.html")
    except:
        return "Not found", 404

@app.route("/records")
def records():
    records = GameRecord.query.order_by(GameRecord.created_at.desc()).all()
    return render_template("records.html", records=records)

@app.route("/view_record", methods=["GET"])
def view_record():
    records = GameRecord.query.order_by(GameRecord.created_at.desc()).all()
    record_id = request.args.get("record_id")
    selected = None
    moves = None
    if record_id:
        selected = GameRecord.query.get(record_id)
        if selected:
            moves = selected.moves
    return render_template("view_record.html", records=records, selected=selected, moves=moves)

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

@socketio.on("apply_convolution")
def handle_apply_convolution(data):
    game_id = data.get("game_id")
    filter_name = data.get("filter")
    


    result = game_manager.apply_convolution(game_id, filter_name)
    emit("convolution_applied", result, broadcast=True)


@socketio.on("reset_board")
def handle_reset_board(data):
    game_id = data["game_id"]
    result = game_manager.reset_game(game_id)
    if result["success"]:
        record = GameRecord(moves=json.dumps(result["moves"]))
        db.session.add(record)
        db.session.commit()
    emit("board_reset", result, broadcast=True)

@app.route("/view_record", methods=["GET"], endpoint="view_record_page")
def view_record():
    records = GameRecord.query.order_by(GameRecord.created_at.desc()).all()
    record_id = request.args.get("record_id")
    selected = None
    moves = None
    if record_id:
        selected = GameRecord.query.get(record_id)
        if selected:
            moves = selected.moves
    return render_template("view_record.html", records=records, selected=selected, moves=moves)

@app.route("/")
def classic_game():
    return render_template("index.html")

@app.route("/conv")
def conv_mode():
    return render_template("conv_mode.html")

@app.route("/card")
def card_mode():
    return render_template("deck_builder.html")

@app.get("/api/cards")
def api_cards():
    return jsonify([
        {"id": 1, "name": "黑棋", "cost": 2},
        {"id": 2, "name": "白棋", "cost": 2},
        {"id": 3, "name": "拆牌", "cost": 3},
        {"id": 4, "name": "3×3破壞", "cost": 4},
    ])

@app.post("/api/decks")
def api_save_deck():
    data = request.get_json()
    # TODO: 寫進資料庫
    return jsonify({"deck_id": "mock123"}), 201

if __name__ == "__main__":
    socketio.run(app, debug=True)