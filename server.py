# server.py  —— formal GO-card battle rules (multi-stone shapes 1-12)
# -------------------------------------------------------------
from app import app, socketio
from flask import request
from flask_socketio import join_room, leave_room, emit
from collections import defaultdict, deque
import random, copy

# ---------- 遊戲參數 ----------
BOARD_SIZE   = 19
MAX_HAND     = 10
ENERGY_GROW  = {1: 2, 5: 3, 7: 4, 9: 5, 11: 6}
MAX_ENERGY   = 6
DIRECTIONS   = [(-1, 0), (1, 0), (0, -1), (0, 1)]      # 上下左右

# ---------- 形狀定義 ----------
# anchor (0,0) 為使用者點擊的位置
SHAPES = {
    1:  {"cost": 1, "vectors": [(0, 0)],                     "dirs": ["h"]},
    2:  {"cost": 2, "vectors": [(0, 0), (1, 0)],             "dirs": ["h", "v"]},           # 長
    3:  {"cost": 2, "vectors": [(0, 0), (1, 1)],             "dirs": ["diag1", "diag2"]},   # 尖
    4:  {"cost": 2, "vectors": [(0, 0), (2, 0)],             "dirs": ["h", "v"]},           # 跳
    5:  {"cost": 2, "vectors": [(0, 0), (3, 0)],             "dirs": ["h", "v"]},           # 大跳
    6:  {"cost": 2, "vectors": [(0, 0), (1, 2)],             "dirs": ["h", "v"]},           # 飛（日字對角）
    7:  {"cost": 2, "vectors": [(0, 0), (1, 1)],             "dirs": ["diag1", "diag2"]},   # 象（田字對角）
    8:  {"cost": 4, "vectors": [(0, 0), (1, 0), (2, 0), (2, 1)], "dirs": ["h", "v"]},       # L
    9:  {"cost": 4, "vectors": [(0, 0), (1, 0), (1, 1), (2, 1)], "dirs": ["h"]},            # 閃電 (Z)
    10: {"cost": 4, "vectors": [(0, 0), (-1, 1), (0, 1), (1, 1)], "dirs": ["h", "v"]},      # Y
    11: {"cost": 4, "vectors": [(-1, 0), (0, 0), (1, 0), (0, 1)], "dirs": ["h", "v"]},      # ㄒ (T)
    12: {"cost": 5, "vectors": None,                         "dirs": ["random5"]},          # 投石器
}

# ---------- 向量轉向工具 ----------
def rotate(vecs, dir_name):
    if dir_name in ("h", None):
        return vecs
    if dir_name == "v":            # 90° 旋
        return [(-dy, dx) for dx, dy in vecs]
    if dir_name == "diag1":        # 主對角 ↘
        return [(dy, dx) for dx, dy in vecs]
    if dir_name == "diag2":        # 副對角 ↙
        return [(-dy, -dx) for dx, dy in vecs]
    return vecs                    # 其他簡單鏡像可自行加

# ---------- 牌組 ----------
def make_deck() -> deque[int]:
    """簡單示範：混入 1-12 號棋形卡各若干張"""
    cards = (
        [1] * 40 +
        [2, 3, 4, 5] * 6 +
        [6, 7] * 5 +
        [8, 9, 10, 11] * 4 +
        [12] * 3
    )
    random.shuffle(cards)
    return deque(cards)

# ---------- 初始狀態 ----------
def initial_state():
    return {
        "turn": 1,
        "turnCount": 1,
        "board": [[0] * BOARD_SIZE for _ in range(BOARD_SIZE)],
        "hands":      {"1": [], "2": []},
        "energyCap":  {"1": 2,  "2": 2},
        "energy":     {"1": 2,  "2": 2},
    }

# ---------- 狀態推送 ----------
def _push_state(room):
    for sid, pid in room.players.items():
        view = copy.deepcopy(room.state)
        opp  = "2" if pid == "1" else "1"
        view["hands"][opp] = len(view["hands"][opp])
        emit("state", view, room=sid)

# ---------- 房間 ----------
class Room:
    def __init__(self, rid: str):
        self.id      = rid
        self.state   = initial_state()
        self.decks   = {"1": make_deck(), "2": make_deck()}
        self.players = {}          # sid ➜ "1" / "2"
        self.ready   = set()
        self.started = False

    # ===== 工具 =====
    def _inside(self, x: int, y: int) -> bool:
        return 0 <= x < BOARD_SIZE and 0 <= y < BOARD_SIZE

    def _get_group_and_liberties(self, x: int, y: int):
        col = self.state["board"][y][x]
        if col == 0:
            return [], True
        vis, group, has_lib = set(), [], False
        stack = [(x, y)]
        while stack:
            cx, cy = stack.pop()
            if (cx, cy) in vis:
                continue
            vis.add((cx, cy))
            group.append((cx, cy))
            for dx, dy in DIRECTIONS:
                nx, ny = cx + dx, cy + dy
                if not self._inside(nx, ny):
                    continue
                nb = self.state["board"][ny][nx]
                if nb == 0:
                    has_lib = True
                elif nb == col and (nx, ny) not in vis:
                    stack.append((nx, ny))
        return group, has_lib

    def _remove_group(self, group):
        for x, y in group:
            self.state["board"][y][x] = 0

    # ===== 進房 =====
    def add_player(self, sid, pid, deck):
        if pid in self.players.values():
            return emit("error", {"msg": "此 player 已在房"}, room=sid)
        if len(self.players) >= 2:
            return emit("error", {"msg": "房間已滿"}, room=sid)

        self.players[sid] = pid
        join_room(self.id)
        self.decks[pid] = deque(deck) if deck else make_deck()
        self.ready.add(pid)

        if len(self.ready) < 2:
            emit("waiting", f"玩家 {pid} 就緒，等待另一位…", room=self.id)
        else:
            self.start_game()

    # ===== 遊戲開始 =====
    def start_game(self):
        if self.started:
            return
        self.started = True
        self.state["turn"] = int(random.choice(["1", "2"]))

        for pid in ("1", "2"):
            random.shuffle(self.decks[pid])
            for _ in range(5):
                self.state["hands"][pid].append(self.decks[pid].popleft())

        _push_state(self)
        for sid, pid in self.players.items():
            view = copy.deepcopy(self.state)
            opp = "2" if pid == "1" else "1"
            view["hands"][opp] = len(view["hands"][opp])
            emit("start", view, room=sid)

    # ===== 行為入口 =====
    def handle_action(self, pid, action):
        if not self.started:
            return emit("error", {"msg": "對戰尚未開始"}, room=self.id)
        if pid != str(self.state["turn"]):
            return emit("error", {"msg": "尚未輪到你"}, room=self.id)

        atype = action.get("type")
        if atype == "playCard":
            self.play_card(pid, action.get("cardId"), action.get("params", {}))
        elif atype == "endTurn":
            self.end_turn()
        else:
            emit("error", {"msg": f"未知指令 {atype}"}, room=self.id)
            return

        _push_state(self)

    # ===== 出牌邏輯 =====
    def play_card(self, pid, card_id, params):
        hand = self.state["hands"][pid]
        if card_id not in hand:
            return emit("error", {"msg": "手牌沒有這張牌"}, room=self.id)

        shape = SHAPES.get(card_id)
        if not shape:
            return emit("error", {"msg": f"未定義 card_id={card_id}"}, room=self.id)

        cost = shape["cost"]
        if self.state["energy"][pid] < cost:
            return emit("error", {"msg": "能量不足"}, room=self.id)

        # ---------- 投石器：隨機五顆 ----------
        if card_id == 12:
            empty = [(x, y) for y in range(BOARD_SIZE)
                              for x in range(BOARD_SIZE)
                              if self.state["board"][y][x] == 0]
            if len(empty) < 5:
                return emit("error", {"msg": "棋盤空位不足"}, room=self.id)

            coords = random.sample(empty, 5)

        # ---------- 其他棋形卡 ----------
        else:
            x0, y0 = params.get("x"), params.get("y")
            dirn   = params.get("dir", "h")
            if x0 is None or y0 is None:
                return emit("error", {"msg": "缺少座標"}, room=self.id)
            if dirn not in shape["dirs"]:
                return emit("error", {"msg": "不支援的方向"}, room=self.id)

            vecs   = rotate(shape["vectors"], dirn)
            coords = [(x0 + dx, y0 + dy) for dx, dy in vecs]

            # 檢查全部格子
            for x, y in coords:
                if not self._inside(x, y):
                    return emit("error", {"msg": "落子超出棋盤"}, room=self.id)
                if self.state["board"][y][x] != 0:
                    return emit("error", {"msg": "其中一格已有棋子"}, room=self.id)

        # ---------- 暫放所有新子 ----------
        player_col   = int(pid)
        opponent_col = 3 - player_col
        for x, y in coords:
            self.state["board"][y][x] = player_col

        # ---------- 提子 ----------
        captured = []
        for x, y in coords:
            for dx, dy in DIRECTIONS:
                nx, ny = x + dx, y + dy
                if self._inside(nx, ny) and self.state["board"][ny][nx] == opponent_col:
                    grp, lib = self._get_group_and_liberties(nx, ny)
                    if not lib:
                        captured.extend(grp)
        if captured:
            self._remove_group(captured)

        # ---------- 自殺檢查 ----------
        suicide = True
        for x, y in coords:
            _, lib = self._get_group_and_liberties(x, y)
            if lib:
                suicide = False
                break
        if suicide:
            for x, y in coords:
                self.state["board"][y][x] = 0
            return emit("error", {"msg": "自殺手不允許"}, room=self.id)

        # ---------- 成功：扣能量、移除手牌 ----------
        self.state["energy"][pid] -= cost
        hand.remove(card_id)

    # ===== 結束回合 =====
    def end_turn(self):
        s = self.state
        now_pid = str(s["turn"])
        s["turnCount"] += 1
        next_pid = "2" if now_pid == "1" else "1"
        s["turn"] = int(next_pid)

        cap = ENERGY_GROW.get(s["turnCount"], s["energyCap"][next_pid])
        s["energyCap"][next_pid] = min(cap, MAX_ENERGY)
        s["energy"][next_pid] = s["energyCap"][next_pid]

        if len(s["hands"][next_pid]) < MAX_HAND and self.decks[next_pid]:
            s["hands"][next_pid].append(self.decks[next_pid].popleft())

    # ===== 斷線 =====
    def remove_player(self, sid):
        self.players.pop(sid, None)
        leave_room(self.id)

# ---------- 房間集合 ----------
rooms = defaultdict(lambda: Room("temp"))

def get_room(rid):
    if rid not in rooms or rooms[rid].id == "temp":
        rooms[rid] = Room(rid)
    return rooms[rid]

# ---------- Socket.IO 事件 ----------
@socketio.on("join")
def on_join(data):
    rid  = data.get("room", "demo")
    pid  = data.get("player", "1")
    deck = data.get("deck", [])
    get_room(rid).add_player(request.sid, pid, deck)

@socketio.on("action")
def on_action(data):
    rid    = data.get("room")
    action = data.get("action", {})
    room   = get_room(rid)
    pid    = room.players.get(request.sid)
    if not pid:
        return emit("error", {"msg": "尚未加入房間"})
    room.handle_action(pid, action)

@socketio.on("disconnect")
def on_disconnect():
    for rid, room in list(rooms.items()):
        if request.sid in room.players:
            room.remove_player(request.sid)
            if not room.players:
                del rooms[rid]
            else:
                emit("waiting", "對手斷線，等待重新連線…", room=rid)
            break

# ---------- 入口 ----------
if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
