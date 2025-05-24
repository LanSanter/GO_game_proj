# server.py  —— formal GO-card battle rules
# -----------------------------------------
# 依 app.py 產生的 app / socketio 實例，新增
# 雙人連線對戰房、能量與回合機制。
# -----------------------------------------
from app import app, socketio
from flask import request
from flask_socketio import join_room, leave_room, emit
from collections import defaultdict, deque
import random
import copy

# ---------- 遊戲參數 ----------
BOARD_SIZE   = 19
MAX_HAND     = 10
ENERGY_GROW  = {1: 2, 5: 3, 7: 4, 9: 5, 11: 6}   # 回合數 : 能量上限
MAX_ENERGY   = 6

def make_deck() -> deque[int]:
    """示範牌組：70 張棋子卡(1) + 40 張測試卡(100~139)"""
    cards = [1] * 70 + list(range(100, 140))
    random.shuffle(cards)
    return deque(cards)

def initial_state() -> dict:
    """依前端 card_battle.js 需要的結構初始化"""
    return {
        "turn": 1,             # 1 = 黑 / 2 = 白
        "turnCount": 1,
        "board": [[0] * BOARD_SIZE for _ in range(BOARD_SIZE)],
        "hands":      {"1": [], "2": []},
        "energyCap":  {"1": 2,  "2": 2},
        "energy":     {"1": 2,  "2": 2},
    }

# ---------- 依玩家裁剪手牌並送狀態 ----------
def _push_state(room: "Room") -> None:
    for sid, pid in room.players.items():
        view = copy.deepcopy(room.state)
        opp  = "2" if pid == "1" else "1"
        view["hands"][opp] = len(view["hands"][opp])      # 對手只顯示張數
        emit("state", view, room=sid)

# ---------- 房間物件 ----------
class Room:
    def __init__(self, rid: str):
        self.id       = rid
        self.state    = initial_state()
        self.decks    = {"1": make_deck(), "2": make_deck()}
        self.players  = {}        # sid ➜ "1" / "2"
        self.ready    = set()
        self.started  = False

    # ---- 進房 ----
    def add_player(self, sid: str, pid: str, deck: list[int]):
        if pid in self.players.values():
            return emit("error", {"msg": "此 player 已在房"}, room=sid)
        if len(self.players) >= 2:
            return emit("error", {"msg": "房間已滿"}, room=sid)

        self.players[sid] = pid
        join_room(self.id)

        # 若前端帶入 deck，覆蓋預設牌組
        self.decks[pid] = deque(deck) if deck else make_deck()
        self.ready.add(pid)

        if len(self.ready) < 2:
            emit("waiting", f"玩家 {pid} 就緒，等待另一位…", room=self.id)
        else:
            self.start_game()

    # ---- 遊戲開始 ----
    def start_game(self):
        if self.started:
            return
        self.started = True

        # 擲硬幣決定先後 (1=黑=player1 / 2=白=player2)
        first = random.choice(["1", "2"])
        self.state["turn"] = int(first)

        # 雙方抽 5 張起手
        for pid in ("1", "2"):
            random.shuffle(self.decks[pid])
            for _ in range(5):
                self.state["hands"][pid].append(self.decks[pid].popleft())

        # 傳送開始狀態並告知前端關掉等待遮罩
        _push_state(self)
        for sid, pid in self.players.items():
            msg = copy.deepcopy(self.state)
            opp = "2" if pid == "1" else "1"
            msg["hands"][opp] = len(msg["hands"][opp])
            emit("start", msg, room=sid)

    # ---- 行為處理 ----
    def handle_action(self, pid: str, action: dict):
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

    # ---- 出牌示範 (僅 id==1 棋子卡) ----
    def play_card(self, pid: str, card_id: int, params: dict):
        hand = self.state["hands"][pid]
        if card_id not in hand:
            return emit("error", {"msg": "手牌沒有這張牌"}, room=self.id)

        # 能量檢查 (示範固定 cost=2，請依卡牌設計調整)
        cost = 2
        if self.state["energy"][pid] < cost:
            return emit("error", {"msg": "能量不足"}, room=self.id)
        self.state["energy"][pid] -= cost

        if card_id == 1:   # 棋子卡邏輯
            x, y = params.get("x"), params.get("y")
            if x is None or y is None:
                return emit("error", {"msg": "缺少座標"}, room=self.id)
            if self.state["board"][y][x] != 0:
                return emit("error", {"msg": "該位置已有棋子"}, room=self.id)
            self.state["board"][y][x] = int(pid)

        hand.remove(card_id)

    # ---- 結束回合 ----
    def end_turn(self):
        s = self.state
        now_pid = str(s["turn"])
        s["turnCount"] += 1
        next_pid = "2" if now_pid == "1" else "1"
        s["turn"] = int(next_pid)

        # 能量上限成長（最多 6）
        cap = ENERGY_GROW.get(s["turnCount"], s["energyCap"][next_pid])
        s["energyCap"][next_pid] = min(cap, MAX_ENERGY)
        # 回合開始能量補滿
        s["energy"][next_pid] = s["energyCap"][next_pid]

        # 抽 1 張牌（若未滿手且牌堆有牌）
        if len(s["hands"][next_pid]) < MAX_HAND and self.decks[next_pid]:
            s["hands"][next_pid].append(self.decks[next_pid].popleft())

    # ---- 斷線 ----
    def remove_player(self, sid: str):
        self.players.pop(sid, None)
        leave_room(self.id)

# ---------- 房間集合 ----------
rooms: dict[str, Room] = defaultdict(lambda: Room("temp"))

def get_room(rid: str) -> Room:
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
                del rooms[rid]      # 全員離房 → 刪房
            else:
                emit("waiting", "對手斷線，等待重新連線…", room=rid)
            break

# ---------- 入口 ----------
if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
