# server.py
# -------------------------------------------------------------
# 目的：沿用 app.py 現有流程，只在 card.battle 部分增加「雙人連線」邏輯
#       + gacha 抽牌同步 deckbuilder
# -------------------------------------------------------------
from app import app, socketio
from flask import request
from flask_socketio import join_room, leave_room, emit
from collections import defaultdict, deque, Counter
import random, copy
from flask import request
from flask_socketio import SocketIO, join_room, leave_room, emit


rooms = {}
# =============== 遊戲房／狀態管理 ============================
BOARD_SIZE   = 19
MAX_HAND     = 10           # 同 card_battle_online.js
ENERGY_GROW  = {1:2, 5:3, 7:4, 9:5, 11:6}   # 回合數 : 能量上限

# -----------------------------------------------------------------
# utils
# -----------------------------------------------------------------
def make_deck() -> deque[int]:
    """預設佔位牌組（正式對戰時會被玩家 deck 覆蓋）"""
    deck = [1]*70 + list(range(100, 140))
    random.shuffle(deck)
    return deque(deck)


def initial_state() -> dict:
    """依 card_battle_online.js 的欄位格式產生一份新遊戲狀態"""
    return {
        "turn": 1,                       # 1=黑、2=白
        "turnCount": 1,
        "board": [[0] * BOARD_SIZE for _ in range(BOARD_SIZE)],
        "hands": {"1": [], "2": []},     # key 必須是字串
        "energyCap": {"1": 2, "2": 2},
        "energy": {"1": 2, "2": 2},
    }


def validate_deck(deck: list[int]):
    return True, ""


# -----------------------------------------------------------------
# 每位玩家僅看到自己完整手牌；對手只看到手牌張數
# -----------------------------------------------------------------
def _send_state_per_player(room: "Room") -> None:
    """
    room.players : {sid: "1"/"2"}
    """
    for sid, pid in room.players.items():
        s = copy.deepcopy(room.state)
        opp = "2" if pid == "1" else "1"
        # 對手手牌只留長度
        s["hands"][opp] = len(s["hands"][opp])
        emit("state", s, room=sid)


# -----------------------------------------------------------------
# 房間物件
# -----------------------------------------------------------------
class Room:
    """單一對戰房，負責遊戲流程與狀態同步"""

    def __init__(self, room_id: str):
        self.id = room_id
        self.state = initial_state()
        self.decks = {"1": make_deck(), "2": make_deck()}  # 之後被玩家 deck 覆蓋
        self.players: dict[str, str] = {}  # sid ➜ "1" / "2"
        self.ready: set[str] = set()       # 已送出合法牌組的 playerId
        self.started = False

    # ---------------- 進房 / 離房 ----------------
    def add_player(self, sid: str, pid: str, deck: list[int]):
        # 房間容量 & 重覆檢查
        if pid in self.players.values():
            emit("error", {"msg": "此 player 已在房"}, room=sid)
            return
        if len(self.players) >= 2:
            emit("error", {"msg": "房間已滿"}, room=sid)
            return

        # 加入房間
        self.players[sid] = pid
        join_room(self.id)

        # 牌組驗證
        ok, msg = validate_deck(deck)
        if not ok:
            emit("error", {"msg": msg}, room=sid)
            return

        # 牌組合法 → 存入房間並標記 ready
        self.decks[pid] = deque(deck.copy())
        self.ready.add(pid)
        print(f"[Room {self.id}] pid={pid} ready ({len(self.ready)}/2)")

        # 等待 / 開始
        if len(self.ready) < 2:
            emit("waiting", f"玩家 {pid} 就緒，等待另一位…", room=self.id)
        else:
            self.start_game()

    def remove_player(self, sid: str):
        pid = self.players.pop(sid, None)
        leave_room(self.id)
        return pid

    # ---------------- 行為處理核心 ----------------
    def handle_action(self, pid: str, action: dict):
        if not self.started:
            return emit("error", {"msg": "對戰尚未開始"}, room=self.id)

        if pid != str(self.state["turn"]):
            return emit("error", {"msg": "尚未輪到你"}, room=self.id)

        atype = action.get("type")
        if atype == "draw":
            self.draw_card(pid)
        elif atype == "playCard":
            self.play_card(pid, action.get("cardId"), action.get("params", {}))
        elif atype == "endTurn":
            self.end_turn()
        else:
            emit("error", {"msg": f"未知指令 {atype}"}, room=self.id)
            return

        # 動作後同步（每人版本不同）
        _send_state_per_player(self)

    # ---------------- 具體行為 --------------------
    def draw_card(self, pid: str):
        if len(self.state["hands"][pid]) >= MAX_HAND:
            return emit("error", {"msg": "手牌已滿"}, room=self.id)
        if not self.decks[pid]:
            return emit("error", {"msg": "牌堆沒牌了"}, room=self.id)
        self.state["hands"][pid].append(self.decks[pid].popleft())

    def play_card(self, pid: str, card_id: int, params: dict):
        """示範只實作『棋子卡』(id==1)，其他卡片留 TODO"""
        hand = self.state["hands"][pid]
        if card_id not in hand:
            return emit("error", {"msg": "手牌沒有這張牌"}, room=self.id)

        # ---- 消耗能量 (棋子卡固定 2) ----
        if self.state["energy"][pid] < 2:
            return emit("error", {"msg": "能量不足"}, room=self.id)
        self.state["energy"][pid] -= 2

        # ---- 棋子卡：落子 ----
        if card_id == 1:
            x, y = params.get("x"), params.get("y")
            if x is None or y is None or not (0 <= x < BOARD_SIZE and 0 <= y < BOARD_SIZE):
                return emit("error", {"msg": "無效座標"}, room=self.id)
            if self.state["board"][y][x] != 0:
                return emit("error", {"msg": "該位置已有棋子"}, room=self.id)
            self.state["board"][y][x] = int(pid)

        # ---- TODO: 其他卡牌效果 ----
        hand.remove(card_id)

    # ---------------- gacha 抽牌同步 ----------------
    def receive_gacha(self, pid: str, cards: list[int], sid: str):
        """
        cards : list[int] 由前端 gacha.js 傳入
        只更新自己手牌並回傳 hand:update，不影響對手
        """
        free = MAX_HAND - len(self.state["hands"][pid])
        if free <= 0:
            return emit("error", {"msg": "手牌已滿"}, room=sid)
        accepted = cards[:free]
        self.state["hands"][pid].extend(accepted)
        emit("hand:update", self.state["hands"][pid], room=sid)

    # ---------------- 對戰開始 / 回合結束 ----------------
    def start_game(self):
        if self.started:
            return
        self.started = True
        print(f"=== Room {self.id} START GAME ===")

        for pid in ("1", "2"):
            random.shuffle(self.decks[pid])
            for _ in range(5):
                self.state["hands"][pid].append(self.decks[pid].popleft())

        _send_state_per_player(self)

    def end_turn(self):
        s = self.state
        pid_now = str(s["turn"])
        turn = s["turnCount"] + 1
        s["turnCount"] = turn
        next_pid = "2" if pid_now == "1" else "1"
        s["turn"] = int(next_pid)

        cap = ENERGY_GROW.get(turn, s["energyCap"][next_pid])
        s["energyCap"][next_pid] = min(cap, 6)
        s["energy"][next_pid] = s["energyCap"][next_pid]


# ==================== 房間集合（in-memory） ====================
rooms: dict[str, Room] = defaultdict(lambda: Room("temp"))  # type: ignore


def get_room(room_id: str) -> Room:
    if room_id not in rooms or rooms[room_id].id == "temp":
        rooms[room_id] = Room(room_id)
    return rooms[room_id]


# ==================== Socket.IO 事件 ===========================
@socketio.on("join")
def on_join(data):
    room_id = data.get("room", "demo")
    pid     = data.get("player", "1")
    deck    = data.get("deck", [])
    room = get_room(room_id)
    room.add_player(request.sid, pid, deck)
@socketio.on("disconnect")
def on_leave():
    for room, info in list(rooms.items()):
        for pid, pdata in list(info["players"].items()):
            if pdata["sid"] == request.sid:
                del info["players"][pid]
                if not info["players"]:
                    del rooms[room]               # 清空空房
                else:
                    socketio.emit("waiting", "對手斷線，等待重新連線…", room=room)
                leave_room(room)
                return


@socketio.on("action")
def on_action(data):
    room_id = data.get("room")
    action = data.get("action", {})
    room = get_room(room_id)
    pid = room.players.get(request.sid)
    if not pid:
        return emit("error", {"msg": "尚未加入房間"})
    room.handle_action(pid, action)


# -------- 新增：gacha -> 手牌，同步 deckbuilder ----------
@socketio.on("gacha:draw")
def on_gacha_draw(data):
    """
    data = {
        room : str,
        cards: [int, ...]
    }
    """
    room_id = data.get("room")
    cards = data.get("cards", [])
    room = get_room(room_id)
    pid = room.players.get(request.sid)
    if not pid:
        return emit("error", {"msg": "尚未加入房間"})
    room.receive_gacha(pid, cards, request.sid)


@socketio.on("disconnect")
def on_disconnect():
    for r in rooms.values():
        if request.sid in r.players:
            r.remove_player(request.sid)
            break


# ====================== Main entry =============================
if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
