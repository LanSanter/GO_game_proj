from flask import Flask, render_template, request, redirect, session, url_for, jsonify
from flask_socketio import SocketIO, emit
from flask_sqlalchemy import SQLAlchemy
from game_logic import GameManager, Game
from user_auth import UserManager
from models import db, User, GameRecord
from filter import FILTER_POOL
import os, json, random
from functools import wraps

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
        return render_template("lobby.html")
    return redirect(url_for('login'))

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        data = request.get_json()
        username = data.get("username")
        password = data.get("password")

        user = User.query.filter_by(username=username).first()
        if user and user_manager.verify_user(username, password):
            session['username'] = username
            return jsonify({"success": True}), 200

        return jsonify({"success": False, "error": "登入失敗，帳號或密碼錯誤"}), 401
    
    return render_template("login.html")

@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        data = request.get_json()
        username = data.get("username")
        password = data.get("password")

        if user_manager.register_user(username, password):
            return jsonify({"success": True}), 201
        else:
            return jsonify({"success": False, "error": "帳號已存在"}), 400
    
    return render_template("register.html")

@app.route("/logout")
def logout():
    session.pop('username', None)
    return redirect(url_for('login'))

# 帳號管理
@app.route("/admin")
def administrator():
    if session.get('username') != 'admin':
        return redirect(url_for('index'))
    users = User.query.all()
    return render_template("admin.html", users=users)

@app.route("/api/admin/users", methods=["POST"])
def admin_create_user():
    try:
        if session.get('username') != 'admin':
            return jsonify({"error": "Unauthorized"}), 403

        data = request.get_json()
        if not data or not data.get('username') or not data.get('password'):
            return jsonify({"error": "缺少帳號或密碼"}), 400

        if User.query.filter_by(username=data['username']).first():
            return jsonify({"error": "帳號已存在"}), 400

        user = User(
            username=data['username'],
            password_hash=user_manager.hash_password(data['password'])
        )
        db.session.add(user)
        db.session.commit()
        return jsonify({"success": True}), 201

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Internal Server Error"}), 500


@app.route("/api/admin/users/<int:user_id>", methods=["DELETE"])
def admin_delete_user(user_id):
    if session.get('username') != 'admin':
        return jsonify({"error": "Unauthorized"}), 403
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    db.session.delete(user)
    db.session.commit()
    return jsonify({"success": True}), 200

@app.route("/api/admin/users/<int:user_id>", methods=["PUT"])
def admin_update_user(user_id):
    if session.get('username') != 'admin':
        return jsonify({"error": "Unauthorized"}), 403
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()
    new_username = data.get("username")
    new_password = data.get("password")

    if new_username:
        # 若更改名稱但新名稱已被使用
        if new_username != user.username and User.query.filter_by(username=new_username).first():
            return jsonify({"error": "帳號已存在"}), 400
        user.username = new_username

    if new_password:
        user.password_hash = user_manager.hash_password(new_password)

    db.session.commit()
    return jsonify({"success": True})

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

# @app.route("/")
# def classic_game():
#     return render_template("index.html")
@app.route("/classic")
def classic_mode():
    return render_template("classic.html")


@app.route("/conv")
def conv_mode():
    return render_template("conv_mode.html")

@socketio.on("place_stone")
def handle_place_stone(data):
    game_id = data["game_id"]
    x, y = data["x"], data["y"]
    color = data["color"]
    result = game_manager.place_stone(game_id, x, y, color)
    emit("update_board", result, broadcast=True)

@socketio.on("conv_place_stone")
def handle_cplace_stone(data):
    game_id = data["game_id"]
    x, y = data["x"], data["y"]
    color = data["color"]
    result = game_manager.conv_place_stone(game_id, x, y, color)
    emit("update_board", result, broadcast=True)

@socketio.on("new_game")
def handle_new_game():
    game_id = game_manager.create_game()
    emit("game_created", {"game_id": game_id})

@socketio.on("reset_board")
def handle_reset_board(data):
    game_id = data["game_id"]
    result = game_manager.reset_game(game_id)
    if result["success"]:
        record = GameRecord(moves=json.dumps(result["moves"]))
        db.session.add(record)
        db.session.commit()
    emit("board_reset", result, broadcast=True)

@app.route("/api/random_filters")
def random_filters():
    selected = random.sample(FILTER_POOL, 3)
    return jsonify(selected)

@socketio.on("apply_convolution")
def handle_apply_convolution(data):
    game_id = data.get("game_id")
    filter_name = data.get("filter")
    turn = data.get("color")
    
    result = game_manager.apply_convolution(game_id, filter_name, turn)
    emit("convolution_applied", result, broadcast=True)

# ----------------------  卡牌系統  ----------------------
@app.route("/card")
def card_index():
    return render_template("card_index.html")

@app.route("/card/build_deck")
def card_build_deck():
    return render_template("card_build_deck.html")

@app.route("/card/battle")
def card_battle():
    return render_template("card_battle.html")

@app.route("/card/gacha")
def card_gacha():
    return render_template("card_gacha.html")

@app.route("/api/card_gacha", methods=["POST"])
def api_card_gacha():
    cards = random.sample(CARD_POOL, 5)
    return jsonify(cards=cards)

# -----------------------  DEMO 卡池與暫存 -----------------------
# ----------------------  卡牌系統：統一卡池與路由 ----------------------
CARD_POOL = [
    {"id": 1, "name": "黑棋", "cost": 2, "type": "stone",
     "img": "/static/img/cards/1.png"},
    {"id": 2, "name": "白棋", "cost": 2, "type": "stone",
     "img": "/static/img/cards/2.png"},
    {"id": 3, "name": "拆牌", "cost": 3, "type": "function",
     "img": "/static/img/cards/3.png"},
    {"id": 4, "name": "3×3 破壞", "cost": 4, "type": "general",
     "img": "/static/img/cards/4.png"},
]

USER_DECKS = {}          # { session.sid : [card ids] }

# --------- 1. 卡池列表（DeckBuilder 用） ---------
@app.route("/api/cards", methods=["GET"])
def api_cards():
    return jsonify(CARD_POOL)          # <─ 一律回傳帶 img 的完整資料

# --------- 2. 儲存 / 讀取牌組 ---------
@app.route("/api/decks", methods=["POST"])
def api_save_deck():
    deck = request.get_json(force=True).get("deck", [])
    USER_DECKS[session.sid] = deck
    return jsonify(success=True), 201

@app.route("/api/decks", methods=["GET"])
def api_get_deck():
    return jsonify(deck=USER_DECKS.get(session.sid, []))

# --------- 3. 抽 5 張手牌 ---------
@app.route("/api/card_deal", methods=["GET"])
def api_card_deal():
    deck = USER_DECKS.get(session.sid)
    if not deck:
        deck = [1]*70 + [3,4,3,4,3]     # demo：至少含 id 3、4 才不會 KeyError
    random.shuffle(deck)
    hand, rest = deck[:5], deck[5:]
    USER_DECKS[session.sid] = rest
    id2card = {c["id"]: c for c in CARD_POOL}
    return jsonify(hand=[id2card[i] for i in hand])


# -----------------------  API: 取得卡池 -----------------------
@app.get("/api/card_collection")
def api_card_collection():
    return jsonify(cards=CARD_POOL)

# -----------------------  API: 儲存牌組 -----------------------
@app.post("/api/card_save_deck")
def api_card_save_deck():
    data = request.get_json()
    USER_DECKS[session.sid] = data.get("deck", [])
    return jsonify(ok=True)

# -----------------------  API: 取得牌組 -----------------------
@app.get("/api/card_get_deck")
def api_card_get_deck():
    return jsonify(deck=USER_DECKS.get(session.sid, []))


if __name__ == "__main__":

    socketio.run(app, debug=True)
    