from app import app, socketio
from flask import request
from flask_socketio import join_room, leave_room, emit
from collections import defaultdict, deque
import random, copy
from typing import List, Tuple

BOARD_SIZE  = 19
MAX_HAND    = 10
MAX_ENERGY  = 6
ENERGY_GROW = {1: 2, 5: 3, 7: 4, 9: 5, 11: 6}
DIRECTIONS  = [(-1,0),(1,0),(0,-1),(0,1)]

FUNC_COST = {13:1,14:0,15:4,16:4,17:3,18:5,19:1,20:5,21:4,22:4,23:3,24:2}

MAGIC_COST = {
    25:3, 26:5, 27:4, 28:4, 29:6, 30:3, 31:3, 32:4,
    33:6, 34:4, 35:2, 36:6, 37:4, 38:4, 39:4,
    40:3, 41:6, 42:2, 43:3, 44:2, 45:6, 46:0, 47:2,
    48:5, 49:4, 50:4
}

def rnd_sample(lst, n):
    n = min(n, len(lst)); random.shuffle(lst)
    return lst[:n], lst[n:]

SHAPES = {
    1: dict(cost=1, vectors=[(0,0)],               dirs=['h']),
    2: dict(cost=2, vectors=[(0,0),(1,0)],         dirs=['h','v']),
    3: dict(cost=2, vectors=[(0,0),(1,1)],         dirs=['r0','r90','r180','r270']),
    4: dict(cost=2, vectors=[(0,0),(2,0)],         dirs=['h','v']),
    5: dict(cost=2, vectors=[(0,0),(3,0)],         dirs=['h','v']),
    6: dict(cost=2, dirs=['dr','rd','ur','ru','dl','ld','ul','lu'],
             vectors_map={
                 "dr":[(0,0),( 1, 2)], "rd":[(0,0),( 2, 1)],
                 "ur":[(0,0),( 1,-2)], "ru":[(0,0),( 2,-1)],
                 "dl":[(0,0),(-1, 2)], "ld":[(0,0),(-2, 1)],
                 "ul":[(0,0),(-1,-2)], "lu":[(0,0),(-2,-1)]
             }),
    7:  dict(cost=2, vectors=[(0,0),(2,2)],         dirs=['r0','r90','r180','r270']),
    8:  dict(cost=4, vectors=[(0,0),(1,0),(2,0),(2,1)], dirs=['r0','r90','r180','r270']),
    9:  dict(cost=4, vectors=[(0,0),(1,0),(1,1),(2,1)], dirs=['r0','r90','r180','r270']),
    10: dict(cost=4, vectors=[(-1,-1),(1,-1),(0,0),(0,1)], dirs=['r0','r90','r180','r270']),
    11: dict(cost=4, vectors=[(-1,0),(0,0),(1,0),(0,1)],   dirs=['r0','r90','r180','r270']),
    12: dict(cost=5, vectors=None, dirs=['random5'])
}

def rotate(vecs, dirn):
    if dirn in ('h',None): return vecs
    if dirn=='v'    : return [(-dy,dx) for dx,dy in vecs]
    if dirn=='diag1': return [( dy, dx) for dx,dy in vecs]
    if dirn=='diag2': return [(-dy,-dx) for dx,dy in vecs]
    if dirn=='diag3': return [( dy,-dx) for dx,dy in vecs]
    if dirn=='diag4': return [(-dy, dx) for dx,dy in vecs]
    return vecs

def make_deck()->deque[int]:
    cards=[1]*40+[2,3,4,5]*6+[6,7]*5+[8,9,10,11]*4+[12]*3
    random.shuffle(cards); return deque(cards)

def initial_state():
    return {
        "turn":1,"turnCount":1,
        "board":[[0]*BOARD_SIZE for _ in range(BOARD_SIZE)],
        "hands":{"1":[],"2":[]},
        "grave":{"1":[],"2":[]},
        "energyCap":{"1":2,"2":2},
        "energy":{"1":2,"2":2},
        "playCount":{"1":0,"2":0},
        "extraDraw":{"1":0,"2":0},
        "drawUsed":{"1":False,"2":False},
        "placements":[],
        "effects":{
            "othello_next":{},
            "mirage_next":{},
            "mirage_remove":[],
            "ban_magic_until":0,
            "blind_until":0,
            "free_magic":{},
            "cost_reduction":{},
            "hand_cap_bonus":{},        
            "barriers":[],
            "pixie":{},
            "guard":{},
            "mines":[],
            "mischief":0,
            "ban_group":None                  
        }
    }

def _push_state(room):
    st  = room.state; eff=st["effects"]
    for sid,pid in room.players.items():
        view = copy.deepcopy(st)
        opp  = "2" if pid=="1" else "1"
        view["hands"][opp] = len(view["hands"][opp])
        if st["turnCount"] <= eff.get("blind_until",0):
            view["board"] = [[0]*BOARD_SIZE for _ in range(BOARD_SIZE)]
        emit("state", view, room=sid)

class Room:
    def __init__(self, rid:str):
        self.id=rid
        self.state=initial_state()
        self.decks={"1":make_deck(),"2":make_deck()}
        self.players={}
        self.ready=set(); self.started=False

    def _inside(self,x,y): return 0<=x<BOARD_SIZE and 0<=y<BOARD_SIZE

    def _hand_cap(self,pid):
        bonus=self.state["effects"]["hand_cap_bonus"].get(pid,0)
        return MAX_HAND + bonus

    def _draw_cards(self,pid:str,n:int):
        h,d=self.state["hands"][pid],self.decks[pid]
        cap=self._hand_cap(pid)
        for _ in range(n):
            if len(h)>=cap or not d: break
            h.append(d.popleft())

    def _discard(self,pid:str,cards:list[int]):
        h=self.state["hands"][pid]
        for cid in cards:
            h.remove(cid); self.state["grave"][pid].append(cid)

    def _get_group_and_liberties(self,x:int,y:int):
        col=self.state["board"][y][x]
        if col==0: return [],True
        group,vis,setlib=[],set(),False
        st=[(x,y)]
        while st:
            cx,cy=st.pop()
            if (cx,cy) in vis: continue
            vis.add((cx,cy)); group.append((cx,cy))
            for dx,dy in DIRECTIONS:
                nx,ny=cx+dx,cy+dy
                if not self._inside(nx,ny): continue
                v=self.state["board"][ny][nx]
                if v==0:setlib=True
                elif v==col and (nx,ny) not in vis: st.append((nx,ny))
        return group,setlib

    def add_player(self,sid,pid,deck):
        if pid in self.players.values():
            return emit("error",{"msg":"此 player 已在房"},room=sid)
        if len(self.players)>=2:
            return emit("error",{"msg":"房滿"},room=sid)
        self.players[sid]=pid; join_room(self.id)
        self.decks[pid]=deque(deck) if deck else make_deck()
        self.ready.add(pid)
        if len(self.ready)<2:
            emit("waiting",f"玩家{pid}就緒，等待另一位…",room=self.id)
        else: self.start_game()

    def start_game(self):
        if self.started: return
        self.started=True
        self.state["turn"]=int(random.choice(["1","2"]))
        for pid in ("1","2"):
            random.shuffle(self.decks[pid])
            for _ in range(5): self.state["hands"][pid].append(self.decks[pid].popleft())
        _push_state(self)
        for sid,pid in self.players.items():
            v=copy.deepcopy(self.state); opp="2" if pid=="1" else "1"
            v["hands"][opp]=len(v["hands"][opp]); emit("start",v,room=sid)

    def handle_action(self,pid,action):
        if not self.started:
            return emit("error",{"msg":"尚未開始"},room=self.id)
        if pid!=str(self.state["turn"]):
            return emit("error",{"msg":"未輪到你"},room=self.id)

        if action.get("type")=="playCard":
            self.play_card(pid,action.get("cardId"),action.get("params",{}))
        elif action.get("type")=="endTurn":
            self.end_turn()
        else:
            emit("error",{"msg":"未知指令"},room=self.id)
            return
        _push_state(self)

    def _is_forbidden(self,pid,x,y):
        tc=self.state["turnCount"]
        for b in self.state["effects"]["barriers"]:
            if tc>b["until"]: continue
            (x0,y0),(x1,y1)=b["rect"]
            if x0<=x<=x1 and y0<=y<=y1:
                if b["both"] or b["owner"]!=pid: return True
        return False

    def _check_mine_trigger(self,coords:list[Tuple[int,int]]):
        eff=self.state["effects"]; triggered=False
        for m in eff["mines"]:
            if not m["active"]: continue
            if any((x,y)==m["pos"] for x,y in coords):
                m["active"]=False; triggered=True
        if triggered: self.end_turn()

    def _othello_flip(self,pid,coords):
        board=self.state["board"]; pc=int(pid); oc=3-pc
        for x0,y0 in coords:
            for dx,dy in [(-1,0),(1,0),(0,-1),(0,1),(-1,-1),(1,1),(1,-1),(-1,1)]:
                line=[]; cx,cy=x0+dx,y0+dy
                while self._inside(cx,cy) and board[cy][cx]==oc:
                    line.append((cx,cy)); cx+=dx; cy+=dy
                if self._inside(cx,cy) and board[cy][cx]==pc and line:
                    for lx,ly in line: board[ly][lx]=pc

    def play_card(self,pid:str,card_id:int,params:dict):
        hand=self.state["hands"][pid]; st=self.state; eff=st["effects"]
        tc=st["turnCount"]; board = st["board"]

        kind = "shape" if card_id<=12 else ("func" if card_id<=24 else "magic")
        ban  = eff.get("ban_group")
        if ban and tc<=ban["until"] and ban["kind"]==kind:
            return emit("error",{"msg":"此牌種被制約"},room=self.id)

        if 25<=card_id<=51 and tc<=eff.get("ban_magic_until",0):
            return emit("error",{"msg":"魔法被封禁"},room=self.id)

        def _calc_cost(cid,base):
            red=eff["cost_reduction"].get(pid,{}).get(cid,0)
            return max(0,base-red)

        def _get_magic_cost(cid):
            if eff["free_magic"].get(pid): return 0
            return _calc_cost(cid,MAGIC_COST.get(cid,1))

        if 13<=card_id<=24:
            cost=_calc_cost(card_id,FUNC_COST[card_id])
            if card_id!=14 and st["energy"][pid]<cost:
                return emit("error",{"msg":"能量不足"},room=self.id)
            if card_id!=14: st["energy"][pid]-=cost
            hand.remove(card_id); st["grave"][pid].append(card_id)
            st["playCount"][pid]+=1; return

        if 25<=card_id<=51:
            cost=_get_magic_cost(card_id)
            if st["energy"][pid]<cost:
                return emit("error",{"msg":"能量不足"},room=self.id)

            ok = getattr(self,f"_magic_{card_id}",lambda *_:False)(pid,params)
            if not ok: return
            st["energy"][pid]-=cost
            hand.remove(card_id); st["grave"][pid].append(card_id)
            st["playCount"][pid]+=1
            return

        shape=SHAPES.get(card_id)
        if not shape: return emit("error",{"msg":"未定義卡"},room=self.id)
        cost=_calc_cost(card_id,shape["cost"])
        if st["energy"][pid]<cost: return emit("error",{"msg":"能量不足"},room=self.id)

        if card_id==12:
            empty=[(x,y) for y in range(BOARD_SIZE) for x in range(BOARD_SIZE)
                   if board[y][x]==0 and not self._is_forbidden(pid,x,y)]
            if len(empty)<5: return emit("error",{"msg":"棋盤空位不足"},room=self.id)
            coords=random.sample(empty,5)
        else:
            x0,y0=params.get("x"),params.get("y")
            dirn=params.get("dir",'h')
            if x0 is None or y0 is None:
                return emit("error",{"msg":"缺座標"},room=self.id)
            if self._is_forbidden(pid,x0,y0):
                return emit("error",{"msg":"此區域被結界"},room=self.id)
            if dirn not in shape["dirs"]:
                return emit("error",{"msg":"方向錯"},room=self.id)
            vecs=shape.get("vectors_map",{}).get(dirn) or rotate(shape["vectors"],dirn)
            coords=[(x0+dx,y0+dy) for dx,dy in vecs]
            for x,y in coords:
                if not self._inside(x,y): return emit("error",{"msg":"越界"},room=self.id)
                if board[y][x] or self._is_forbidden(pid,x,y):
                    return emit("error",{"msg":"無法落子"},room=self.id)

        pc=int(pid); oc=3-pc
        for x,y in coords: board[y][x]=pc

        cap=[]
        for x,y in coords:
            for dx,dy in DIRECTIONS:
                nx,ny=x+dx,y+dy
                if self._inside(nx,ny) and board[ny][nx]==oc:
                    g,lib=self._get_group_and_liberties(nx,ny)
                    if not lib: cap.extend(g)
        for x,y in cap:
            if eff["guard"].pop((x,y),None): continue
            board[y][x]=0

        if all(not self._get_group_and_liberties(x,y)[1] for x,y in coords):
            for x,y in coords: board[y][x]=0
            return emit("error",{"msg":"自殺手"},room=self.id)

        if eff["othello_next"].pop(pid,None): self._othello_flip(pid,coords)

        if eff["mirage_next"].pop(pid,None):
            sec=params.get("second")
            if not sec: return emit("error",{"msg":"缺 second"},room=self.id)
            sx,sy=sec["x"],sec["y"]
            if not self._inside(sx,sy) or board[sy][sx] or self._is_forbidden(pid,sx,sy):
                return emit("error",{"msg":"second 無效"},room=self.id)
            board[sy][sx]=pc
            eff["mirage_remove"].append((sx,sy,tc+6))

        self._check_mine_trigger(coords)

        st["placements"].append({"turn":tc,"coords":coords})

        st["energy"][pid]-=cost; hand.remove(card_id)
        st["playCount"][pid]+=1

    def _magic_25(self,pid,params):
        src=params.get("src"); dst=params.get("dst")
        if not src or not dst: emit("error",{"msg":"缺 src/dst"},room=self.id); return False
        sx,sy=src["x"],src["y"]; dx,dy=dst["x"],dst["y"]
        bd=self.state["board"]
        if not (self._inside(sx,sy) and self._inside(dx,dy)):
            emit("error",{"msg":"越界"},room=self.id); return False
        if bd[sy][sx]!=int(pid) or bd[dy][dx]!=(3-int(pid)):
            emit("error",{"msg":"棋子不符"},room=self.id); return False
        bd[sy][sx],bd[dy][dx]=bd[dy][dx],bd[sy][sx]; return True

    def _magic_26(self,pid,params):
        a=params.get("anchor"); bd=self.state["board"]
        if not a: emit("error",{"msg":"缺 anchor"},room=self.id); return False
        ax,ay=a["x"],a["y"]
        for dy in (-1,0,1):
            for dx in (-1,0,1):
                x,y=ax+dx,ay+dy
                if self._inside(x,y) and not self.state["effects"]["guard"].pop((x,y),None):
                    bd[y][x]=0
        return True

    def _magic_27(self,pid,params):
        a=params.get("anchor"); dirn=params.get("dir"); bd=self.state["board"]
        if not a or dirn not in ("h","v"): emit("error",{"msg":"缺參數"},room=self.id); return False
        ax,ay=a["x"],a["y"]
        if dirn=="h":
            for x in range(BOARD_SIZE):
                if not self.state["effects"]["guard"].pop((x,ay),None): bd[ay][x]=0
        else:
            for y in range(BOARD_SIZE):
                if not self.state["effects"]["guard"].pop((ax,y),None): bd[y][ax]=0
        return True

    def _magic_28(self,pid,params):
        bd=self.state["board"]; guard=self.state["effects"]["guard"]
        for _ in range(3):
            ax=random.randint(1,BOARD_SIZE-2); ay=random.randint(1,BOARD_SIZE-2)
            for dy in (-1,0,1):
                for dx in (-1,0,1):
                    x,y=ax+dx,ay+dy
                    if not guard.pop((x,y),None): bd[y][x]=0
        return True

    def _magic_29(self,pid,params):
        self.state["effects"]["othello_next"][pid]=True; return True

    def _magic_30(self,pid,params):
        self.state["effects"]["mirage_next"][pid]=True; return True

    def _magic_31(self,pid,params):
        self.state["effects"]["ban_magic_until"]=self.state["turnCount"]+10; return True

    def _magic_32(self,pid,params):
        self.state["effects"]["blind_until"]=self.state["turnCount"]+6; return True

    def _magic_33(self,pid,params):
        self._draw_cards(pid,3)
        if any(25<=cid<=51 for cid in self.state["hands"][pid][-3:]):
            self.state["effects"]["free_magic"][pid]=True
        return True

    def _magic_34(self,pid,params):
        h=self.state["hands"][pid]; d=self.decks[pid]
        while d:
            cid=d.popleft(); h.append(cid)
            if 25<=cid<=51:
                eff=self.state["effects"]["cost_reduction"].setdefault(pid,{})
                eff[cid]=2; break
        return True

    def _magic_35(self,pid,params):
        x,y=params.get("x"),params.get("y")
        if x is None or y is None: emit("error",{"msg":"缺座標"},room=self.id); return False
        bd=self.state["board"]
        if not self._inside(x,y) or bd[y][x]!=(3-int(pid)):
            emit("error",{"msg":"需選敵棋"},room=self.id); return False
        if self.state["effects"]["guard"].pop((x,y),None): return True
        bd[y][x]=0; return True

    def _magic_36(self,pid,params):
        targets=params.get("targets",[])
        if len(targets)!=4: emit("error",{"msg":"需 4 格"},room=self.id); return False
        bd=self.state["board"]; guard=self.state["effects"]["guard"]
        for x,y in targets:
            if not self._inside(x,y) or bd[y][x]!=(3-int(pid)):
                emit("error",{"msg":"目標錯"},room=self.id); return False
        for x,y in targets:
            if not guard.pop((x,y),None): bd[y][x]=0
        return True

    def _magic_37(self,pid,params):
        a=params.get("anchor")
        if not a: emit("error",{"msg":"缺 anchor"},room=self.id); return False
        x0,y0=a["x"]-1,a["y"]-1; x1,y1=a["x"]+1,a["y"]+1
        self.state["effects"]["barriers"].append(
            {"rect":((max(0,x0),max(0,y0)),(min(BOARD_SIZE-1,x1),min(BOARD_SIZE-1,y1))),
             "until":self.state["turnCount"]+6,"both":False,"owner":pid})
        return True

    def _magic_38(self,pid,params):
        a=params.get("anchor")
        if not a: emit("error",{"msg":"缺 anchor"},room=self.id); return False
        x0,y0=a["x"]-1,a["y"]-1; x1,y1=a["x"]+1,a["y"]+1
        self.state["effects"]["barriers"].append(
            {"rect":((max(0,x0),max(0,y0)),(min(BOARD_SIZE-1,x1),min(BOARD_SIZE-1,y1))),
             "until":self.state["turnCount"]+10,"both":True,"owner":pid})
        return True

    def _magic_39(self,pid,params):
        self.state["effects"]["pixie"][pid]=3; return True

    def _magic_40(self,pid,params): return True

    def _magic_41(self,pid,params): return True

    def _magic_42(self,pid,params):
        x,y=params.get("x"),params.get("y")
        bd=self.state["board"]
        if x is None or y is None or not self._inside(x,y) or bd[y][x]!=int(pid):
            emit("error",{"msg":"需選己棋"},room=self.id); return False
        self.state["effects"]["guard"][(x,y)]=True; return True

    def _magic_43(self,pid,params):
        locs=params.get("points",[])
        if len(locs)!=3: emit("error",{"msg":"需 3 點"},room=self.id); return False
        for x,y in locs:
            if not self._inside(x,y) or self.state["board"][y][x]:
                emit("error",{"msg":"地雷格無效"},room=self.id); return False
        self.state["effects"]["mines"].extend(
            [{"pos":(x,y),"active":True} for x,y in locs])
        return True

    def _magic_44(self,pid,params):
        self.state["effects"]["mischief"]=6; return True

    def _magic_46(self,pid,params):
        self.state["energy"][pid]=min(self.state["energyCap"][pid],self.state["energy"][pid]+2); return True
    def _magic_47(self,pid,params):
        import random
        delta=random.randint(1,6)
        self.state["energy"][pid]=min(self.state["energyCap"][pid],self.state["energy"][pid]+delta); return True

    def _magic_48(self,pid,params):
        target=params.get("card")
        if target is None:
            emit("error",{"msg":"需指定 card"},room=self.id); return False
        eff=self.state["effects"]["cost_reduction"].setdefault(pid,{})
        eff[target]=eff.get(target,0)+2
        return True

    def _magic_49(self,pid,params):
        tc=self.state["turnCount"]
        targets=[p for p in self.state["placements"] if p["turn"] in (tc-1,tc-2)]
        bd=self.state["board"]; guard=self.state["effects"]["guard"]
        for move in targets:
            for x,y in move["coords"]:
                if bd[y][x] and not guard.pop((x,y),None):
                    bd[y][x]=0
        return True

    def _magic_50(self,pid,params):
        bonus=self.state["effects"]["hand_cap_bonus"]
        bonus[pid]=bonus.get(pid,0)+1
        return True

    def _magic_51(self,pid,params):
        kind=params.get("kind")
        if kind not in ("shape","func","magic"):
            emit("error",{"msg":"kind 應為 shape/func/magic"},room=self.id); return False
        self.state["effects"]["ban_group"]={"kind":kind,"until":self.state["turnCount"]+6}
        return True

    def end_turn(self):
        s=self.state; eff=s["effects"]; now=str(s["turn"]); nxt="2" if now=="1" else "1"
        s["turnCount"]+=1; s["turn"]=int(nxt)

        nc=ENERGY_GROW.get(s["turnCount"])
        if nc and nc>s["energyCap"]["1"]:
            diff=nc-s["energyCap"]["1"]
            for p in ("1","2"):
                s["energyCap"][p]=nc
                s["energy"][p]=min(s["energy"][p]+diff,nc)

        s["energy"][nxt]=s["energyCap"][nxt]
        self._draw_cards(nxt,1)

        ex=s["extraDraw"][nxt]
        if ex: self._draw_cards(nxt,ex); s["extraDraw"][nxt]=0

        eff["free_magic"].pop(now,None)

        bd=s["board"]
        eff["mirage_remove"][:]=[(x,y,t) for x,y,t in eff["mirage_remove"] if t>=s["turnCount"]]
        for x,y,t in [v for v in eff["mirage_remove"] if t==s["turnCount"]]:
            bd[y][x]=0

        if eff["pixie"].get(nxt):
            empty=[(x,y) for y in range(BOARD_SIZE) for x in range(BOARD_SIZE) if bd[y][x]==0]
            if empty:
                x,y=random.choice(empty); bd[y][x]=int(nxt)
            eff["pixie"][nxt]-=1
            if eff["pixie"][nxt]==0: del eff["pixie"][nxt]

        if eff["mischief"]>0:
            stones=[(x,y) for y in range(BOARD_SIZE) for x in range(BOARD_SIZE) if bd[y][x]]
            if stones:
                x,y=random.choice(stones)
                if not eff["guard"].pop((x,y),None): bd[y][x]=0
            eff["mischief"]-=1

        for p in (now,nxt): s["playCount"][p]=0; s["drawUsed"][p]=False

    def remove_player(self,sid):
        self.players.pop(sid,None); leave_room(self.id)

rooms=defaultdict(lambda:Room("temp"))
def get_room(rid):
    if rid not in rooms or rooms[rid].id=="temp": rooms[rid]=Room(rid)
    return rooms[rid]

@socketio.on("join")
def on_join(data):
    get_room(data.get("room","demo")).add_player(
        request.sid,data.get("player","1"),data.get("deck",[])
    )

@socketio.on("action")
def on_action(data):
    room=get_room(data.get("room")); pid=room.players.get(request.sid)
    if not pid: return emit("error",{"msg":"尚未入房"})
    room.handle_action(pid,data.get("action",{}))

@socketio.on("disconnect")
def on_disconnect():
    for rid,rm in list(rooms.items()):
        if request.sid in rm.players:
            rm.remove_player(request.sid)
            if not rm.players: del rooms[rid]
            else: emit("waiting","對手斷線，等待重連…",room=rid)
            break

if __name__=="__main__":
    socketio.run(app,host="0.0.0.0",port=5000,debug=True)
