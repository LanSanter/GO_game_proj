# backend/game_state.py
import random
from card_effect import CARD_EFFECTS_PY   # 與前端同內容、Python 語法

BOARD_SIZE = 19
ENERGY_CAP_MAX = 6
DEFAULT_COPIES_EACH = 2

class GameState:
    def __init__(self):
        self.turn       = 1           # 1=黑, 2=白
        self.turn_count = 1
        self.board      = [[0]*BOARD_SIZE for _ in range(BOARD_SIZE)]
        self.energy_cap = {1: 2, 2: 2}
        self.energy     = {1: 2, 2: 2}
        self.hands      = {1: [], 2: []}
        self.deck       = {1: self._init_deck(), 2: self._init_deck()}

        for p in (1, 2):
            self._draw(p, 5)          # 首抽 5 張

    # ---------- public ----------
    def to_json(self):
        return {
            "turn"      : self.turn,
            "turnCount" : self.turn_count,
            "board"     : self.board,
            "hands"     : self.hands,
            "energy"    : self.energy,
            "energyCap" : self.energy_cap,
        }

    def apply_action(self, player, payload):
        """player=行動者 (1/2)；payload = 前端送來的 action dict"""
        if player != self.turn:
            return {"ok": False, "msg": "Not your turn!"}

        t = payload["type"]

        if t == "place":
            # 先保留給「純落子」動作用（如果有）
            pass

        elif t == "playCard":
            cid     = str(payload["cardId"])
            params  = payload.get("params", {})
            if cid not in self.hands[player]:
                return {"ok": False, "msg": "你沒有這張牌"}
            card_def = CARD_EFFECTS_PY[cid]
            if self.energy[player] < card_def["cost"]:
                return {"ok": False, "msg": "能量不足"}

            # ★執行卡牌效果（覆蓋 self.board 等）-------------
            ok, msg = card_def["effect"](self, params)
            if not ok:
                return {"ok": False, "msg": msg}

            # 消耗能量 / 移除手牌
            self.energy[player] -= card_def["cost"]
            self.hands[player].remove(cid)

            # 自動結束回合
            self._end_turn()
            return {"ok": True}

        elif t == "draw":
            self._draw(player, 1)
            return {"ok": True}

        elif t == "endTurn":
            self._end_turn()
            return {"ok": True}

        else:
            return {"ok": False, "msg": "未知動作"}

    # ---------- private ----------
    def _init_deck(self):
        pool = []
        for cid in range(1, 51):
            pool += [str(cid)] * DEFAULT_COPIES_EACH
        random.shuffle(pool)
        return pool

    def _draw(self, player, n):
        for _ in range(n):
            if len(self.hands[player]) >= 10 or not self.deck[player]:
                break
            self.hands[player].append(self.deck[player].pop())

    def _end_turn(self):
        self.turn_count += 1
        # 每 2 回合能量 cap +1，最多 6
        if self.turn_count >= 5 and (self.turn_count - 5) % 2 == 0:
            for p in (1, 2):
                self.energy_cap[p] = min(ENERGY_CAP_MAX, self.energy_cap[p]+1)

        # 換手 & 補滿能量 & 抽 1
        self.turn = 3 - self.turn
        self.energy[self.turn] = self.energy_cap[self.turn]
        self._draw(self.turn, 1)
